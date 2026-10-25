import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  TEST_EVENT_NAME,
  anonClient,
  createTestEvent,
  daysFromToday,
  deleteTestEvent,
  fakeImage,
  hostClient,
  newGuestToken,
  type TestEvent,
} from '../helpers'

type EventRow = { host_note: string | null; host_note_updated_at: string | null; parent_name: string | null }
type Part = { invite_code: string; event_date: string; dress_code_text: string | null }

let host: SupabaseClient
const guest = anonClient()
const created: TestEvent[] = []

async function newEvent(fields: Record<string, unknown> = {}) {
  const event = await createTestEvent(host, fields)
  created.push(event)
  return event
}

const getEvent = async (code: string) =>
  (await guest.rpc('get_event_by_code', { p_code: code }).maybeSingle()).data as EventRow | null

beforeAll(async () => {
  host = await hostClient()
})

afterAll(async () => {
  // Parts first, so no parent is deleted out from under them.
  for (const event of created.reverse()) await deleteTestEvent(host, event)
})

describe('pinned host note', () => {
  it('shows guests the note and when it was last changed', async () => {
    const event = await newEvent()
    const before = Date.now()
    const { error } = await host.from('events').update({ host_note: 'Ceremony moved outdoors' }).eq('id', event.id)
    expect(error).toBeNull()

    const shown = await getEvent(event.code)
    expect(shown?.host_note).toBe('Ceremony moved outdoors')
    expect(Date.parse(shown!.host_note_updated_at!)).toBeGreaterThanOrEqual(before - 60_000)

    await host.from('events').update({ host_note: null }).eq('id', event.id)
    expect(await getEvent(event.code)).toMatchObject({ host_note: null, host_note_updated_at: null })
  })

  it("can't be set by a guest", async () => {
    const event = await newEvent()
    await guest.from('events').update({ host_note: 'Not the host' }).eq('id', event.id)
    expect((await getEvent(event.code))?.host_note).toBeNull()
  })

  it('is limited to 500 characters', async () => {
    const event = await newEvent()
    const { error } = await host.from('events').update({ host_note: 'x'.repeat(501) }).eq('id', event.id)
    expect(error).not.toBeNull()
  })
})

describe('events with parts', () => {
  let parent: TestEvent
  let brunch: TestEvent
  let drinks: TestEvent

  beforeAll(async () => {
    parent = await newEvent({ event_date: daysFromToday(20) })
    brunch = await newEvent({ parent_event_id: parent.id, event_date: daysFromToday(21), dress_code_text: 'Garden casual' })
    drinks = await newEvent({ parent_event_id: parent.id, event_date: daysFromToday(19) })
  })

  it("lists a celebration's parts in date order for anyone with its code", async () => {
    const { data, error } = await guest.rpc('get_event_parts_by_code', { p_code: parent.code })
    expect(error).toBeNull()
    expect((data as Part[]).map((p) => p.invite_code)).toEqual([drinks.code, brunch.code])
    expect((data as Part[])[1].dress_code_text).toBe('Garden casual')
  })

  it("names the parent on a part's page but doesn't reveal its code", async () => {
    const shown = await getEvent(brunch.code)
    expect(shown?.parent_name).toBe(TEST_EVENT_NAME)
    expect(JSON.stringify(shown)).not.toContain(parent.code)

    const { data } = await guest.rpc('get_event_parts_by_code', { p_code: brunch.code })
    expect(data).toEqual([])
  })

  it('allows only one level', async () => {
    const { error: nested } = await host
      .from('events')
      .insert({
        host_id: (await host.auth.getUser()).data.user!.id,
        name: TEST_EVENT_NAME,
        event_date: daysFromToday(21),
        location: 'Test Hall',
        invite_code: `NEST${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
        parent_event_id: brunch.id,
      })
    expect(nested?.message).toMatch(/can't have parts/)

    const standalone = await newEvent()
    const { error: parentAsPart } = await host
      .from('events')
      .update({ parent_event_id: standalone.id })
      .eq('id', parent.id)
    expect(parentAsPart?.message).toMatch(/with parts can't become a part/)

    const { error: itself } = await host.from('events').update({ parent_event_id: drinks.id }).eq('id', drinks.id)
    expect(itself?.message).toMatch(/part of itself/)
  })
})

describe('after the event', () => {
  it('still takes outfit posts but no new polls', async () => {
    const event = await newEvent({ event_date: daysFromToday(-3) })
    const token = newGuestToken()

    const { error: postError } = await guest.rpc('insert_outfit_post', {
      p_code: event.code,
      p_display_name: 'Guest',
      p_image_url: fakeImage(event.id, 'what-i-wore'),
      p_caption: null,
      p_guest_token: token,
      p_colors: [],
    })
    expect(postError).toBeNull()

    const { error: pollError } = await guest.rpc('create_outfit_poll', {
      p_code: event.code,
      p_display_name: 'Guest',
      p_guest_token: token,
      p_image_urls: [fakeImage(event.id, 'a'), fakeImage(event.id, 'b')],
    })
    expect(pollError?.message).toMatch(/event is over/)
  })
})
