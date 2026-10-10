import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  anonClient,
  createTestEvent,
  daysFromToday,
  deleteTestEvent,
  fakeImage,
  hostClient,
  newGuestToken,
  type TestEvent,
} from '../helpers'

type Option = { id: string; image_url: string; position: number; votes: number | null }
type Post = {
  id: string
  is_poll: boolean
  image_url: string
  options: Option[] | null
  my_vote: string | null
  total_votes: number | null
  poll_closes_at: string | null
}

let host: SupabaseClient
let event: TestEvent
const guest = anonClient()
const eventDate = daysFromToday(10)

beforeAll(async () => {
  host = await hostClient()
  event = await createTestEvent(host, { event_date: eventDate })
})

afterAll(async () => {
  if (event) await deleteTestEvent(host, event)
})

async function createPoll(token: string, images = 2, closesAt: string | null = null) {
  return guest.rpc('create_outfit_poll', {
    p_code: event.code,
    p_display_name: 'Undecided',
    p_guest_token: token,
    p_image_urls: Array.from({ length: images }, (_, i) => fakeImage(event.id, `option-${i + 1}`)),
    p_caption: 'Which one?',
    p_closes_at: closesAt,
  })
}

async function getPost(id: string, viewerToken: string | null = null): Promise<Post | undefined> {
  const { data, error } = await guest.rpc('get_outfit_posts_by_code', {
    p_code: event.code,
    p_viewer_token: viewerToken,
  })
  if (error) throw error
  return (data as Post[]).find((p) => p.id === id)
}

const vote = (optionId: string, token: string) =>
  guest.rpc('vote_on_poll', { p_code: event.code, p_option_id: optionId, p_voter_token: token })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('creating polls', () => {
  it('accepts 2 or 3 options and rejects other counts', async () => {
    expect((await createPoll(newGuestToken(), 2)).error).toBeNull()
    expect((await createPoll(newGuestToken(), 3)).error).toBeNull()
    expect((await createPoll(newGuestToken(), 1)).error).not.toBeNull()
    expect((await createPoll(newGuestToken(), 4)).error).not.toBeNull()
  })

  it('defaults the deadline to midnight UTC at the start of the event day', async () => {
    const { data: id } = await createPoll(newGuestToken())
    const post = await getPost(id)
    expect(new Date(post!.poll_closes_at!).toISOString()).toBe(`${eventDate}T00:00:00.000Z`)
  })

  it('keeps a custom deadline and rejects one in the past', async () => {
    const soon = new Date(Date.now() + 3 * 3_600_000)
    const { data: id } = await createPoll(newGuestToken(), 2, soon.toISOString())
    expect(Date.parse((await getPost(id))!.poll_closes_at!)).toBeCloseTo(soon.getTime(), -3)

    const { error } = await createPoll(newGuestToken(), 2, '2020-01-01T00:00:00Z')
    expect(error?.message).toContain('deadline')
  })
})

describe('voting', () => {
  it('hides results until you vote, and shows them to the poster', async () => {
    const poster = newGuestToken()
    const voter = newGuestToken()
    const { data: id } = await createPoll(poster)

    const before = await getPost(id, voter)
    expect(before!.total_votes).toBeNull()
    expect(before!.options!.every((o) => o.votes === null)).toBe(true)

    expect((await vote(before!.options![1].id, voter)).error).toBeNull()
    const after = await getPost(id, voter)
    expect(after!.my_vote).toBe(before!.options![1].id)
    expect(after!.total_votes).toBe(1)
    expect(after!.options!.map((o) => o.votes)).toEqual([0, 1])

    expect((await getPost(id, poster))!.total_votes).toBe(1)
    expect((await getPost(id, newGuestToken()))!.total_votes).toBeNull()
  })

  it('switches your vote instead of counting it twice', async () => {
    const voter = newGuestToken()
    const { data: id } = await createPoll(newGuestToken())
    const [first, second] = (await getPost(id))!.options!

    await vote(first.id, voter)
    await vote(second.id, voter)
    const post = await getPost(id, voter)
    expect(post!.total_votes).toBe(1)
    expect(post!.my_vote).toBe(second.id)
  })
})

describe('closing polls', () => {
  it('only lets the poster pick the winner, which turns the poll into an outfit post', async () => {
    const poster = newGuestToken()
    const { data: id } = await createPoll(poster)
    const [first, second] = (await getPost(id))!.options!
    const pick = (token: string) =>
      guest.rpc('pick_poll_winner', { p_code: event.code, p_post_id: id, p_option_id: second.id, p_guest_token: token })

    expect((await pick(newGuestToken())).error).not.toBeNull()

    const { data: losers, error } = await pick(poster)
    expect(error).toBeNull()
    expect(losers).toEqual([first.image_url])
    expect(await getPost(id)).toMatchObject({ is_poll: false, image_url: second.image_url, poll_closes_at: null })
  })

  it('leaves polls open before their deadline', async () => {
    const { data: id } = await createPoll(newGuestToken())
    const { data: losers } = await guest.rpc('close_due_polls', { p_code: event.code })
    expect(losers).toEqual([])
    expect((await getPost(id))!.is_poll).toBe(true)
  })
})

describe('polls past their deadline', () => {
  // Polls with a deadline a few seconds out; the beforeAll votes on them,
  // then waits once for all the deadlines to pass.
  let topVoted: { id: string; options: Option[] }
  let tied: { id: string; options: Option[] }
  let silent: { id: string; options: Option[] }
  let losers: string[]

  async function shortPoll(images = 2) {
    const { data: id, error } = await createPoll(
      newGuestToken(),
      images,
      new Date(Date.now() + 4_000).toISOString()
    )
    if (error) throw error
    return { id: id as string, options: (await getPost(id))!.options! }
  }

  beforeAll(async () => {
    topVoted = await shortPoll(3)
    tied = await shortPoll()
    silent = await shortPoll()
    await vote(topVoted.options[2].id, newGuestToken())
    await vote(topVoted.options[2].id, newGuestToken())
    await vote(topVoted.options[0].id, newGuestToken())
    await vote(tied.options[0].id, newGuestToken())
    await vote(tied.options[1].id, newGuestToken())
    await sleep(6_000)

    // A different event's code must not close these.
    await guest.rpc('close_due_polls', { p_code: 'NOPE0000' })
    expect((await getPost(topVoted.id))!.is_poll).toBe(true)

    const { data, error } = await guest.rpc('close_due_polls', { p_code: event.code })
    if (error) throw error
    losers = data as string[]
  })

  it('makes the top-voted option the outfit', async () => {
    const [first, second, third] = topVoted.options
    expect(await getPost(topVoted.id)).toMatchObject({ is_poll: false, image_url: third.image_url, options: null })
    expect(losers).toEqual(expect.arrayContaining([first.image_url, second.image_url]))
    expect(losers).not.toContain(third.image_url)
  })

  it('breaks ties, and no votes at all, in favor of the first option', async () => {
    expect((await getPost(tied.id))!.image_url).toBe(tied.options[0].image_url)
    expect((await getPost(silent.id))!.image_url).toBe(silent.options[0].image_url)
  })

  it('returns every losing photo for cleanup', async () => {
    expect(losers).toHaveLength(2 + 1 + 1)
  })
})
