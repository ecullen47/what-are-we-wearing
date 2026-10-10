import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  anonClient,
  createTestEvent,
  deleteTestEvent,
  fakeImage,
  hostClient,
  newGuestToken,
  type TestEvent,
} from '../helpers'

let host: SupabaseClient
let event: TestEvent
const guest = anonClient()

beforeAll(async () => {
  host = await hostClient()
  event = await createTestEvent(host)
})

afterAll(async () => {
  if (event) await deleteTestEvent(host, event)
})

async function post(token: string, fields: Record<string, unknown> = {}) {
  return guest.rpc('insert_outfit_post', {
    p_code: event.code,
    p_display_name: 'Guest',
    p_image_url: fakeImage(event.id, 'outfit'),
    p_caption: null,
    p_guest_token: token,
    p_colors: ['sage'],
    ...fields,
  })
}

async function posts(viewerToken: string | null = null) {
  const { data, error } = await guest.rpc('get_outfit_posts_by_code', {
    p_code: event.code,
    p_viewer_token: viewerToken,
  })
  if (error) throw error
  return data as Record<string, unknown>[]
}

describe('event lookup', () => {
  it('finds the event by invite code without exposing the host id', async () => {
    const { data, error } = await guest.rpc('get_event_by_code', { p_code: event.code }).maybeSingle()
    expect(error).toBeNull()
    expect(data).toMatchObject({ id: event.id, invite_code: event.code, dress_code_text: 'Cocktail' })
    expect(data).not.toHaveProperty('host_id')
  })

  it('returns nothing for an unknown code', async () => {
    const { data } = await guest.rpc('get_event_by_code', { p_code: 'NOPE0000' }).maybeSingle()
    expect(data).toBeNull()
  })
})

describe('guest outfit posts', () => {
  it('lets a guest post without an account, and lists it without the guest token', async () => {
    const token = newGuestToken()
    const { data: id, error } = await post(token, { p_display_name: 'Sam', p_caption: 'Green dress' })
    expect(error).toBeNull()

    const found = (await posts()).find((p) => p.id === id)
    expect(found).toMatchObject({ display_name: 'Sam', caption: 'Green dress', colors: ['sage'], is_poll: false })
    expect(JSON.stringify(found)).not.toContain(token)
  })

  it('rejects posts to an unknown event, blank names and more than 3 colors', async () => {
    expect((await post(newGuestToken(), { p_code: 'NOPE0000' })).error).not.toBeNull()
    expect((await post(newGuestToken(), { p_display_name: '   ' })).error).not.toBeNull()
    expect((await post(newGuestToken(), { p_colors: ['black', 'white', 'sage', 'blush'] })).error).not.toBeNull()
  })

  it('only lets the poster edit their post', async () => {
    const token = newGuestToken()
    const { data: id } = await post(token)
    const edit = (asToken: string) =>
      guest.rpc('update_own_outfit_post', {
        p_code: event.code,
        p_post_id: id,
        p_guest_token: asToken,
        p_display_name: 'Edited',
        p_image_url: fakeImage(event.id, 'edited'),
        p_caption: 'New caption',
        p_colors: ['black'],
      })

    expect((await edit(newGuestToken())).error).not.toBeNull()
    expect((await posts()).find((p) => p.id === id)?.display_name).toBe('Guest')

    expect((await edit(token)).error).toBeNull()
    expect((await posts()).find((p) => p.id === id)).toMatchObject({ display_name: 'Edited', colors: ['black'] })
  })

  it('only lets the poster delete their post', async () => {
    const token = newGuestToken()
    const { data: id } = await post(token)
    const remove = (asToken: string) =>
      guest.rpc('delete_own_outfit_post', { p_code: event.code, p_post_id: id, p_guest_token: asToken })

    expect((await remove(newGuestToken())).error).not.toBeNull()
    expect((await posts()).some((p) => p.id === id)).toBe(true)

    expect((await remove(token)).error).toBeNull()
    expect((await posts()).some((p) => p.id === id)).toBe(false)
  })

  it('lets the host delete any post on their event', async () => {
    const { data: id } = await post(newGuestToken())
    const { error } = await host.from('outfit_posts').delete().eq('id', id)
    expect(error).toBeNull()
    expect((await posts()).some((p) => p.id === id)).toBe(false)
  })
})

describe('likes', () => {
  it('toggles a like per guest and counts likes from everyone', async () => {
    const { data: id } = await post(newGuestToken())
    const alice = newGuestToken()
    const bob = newGuestToken()
    const like = (token: string) =>
      guest.rpc('toggle_outfit_like', { p_code: event.code, p_post_id: id, p_token: token })

    expect((await like(alice)).data).toBe(true)
    expect((await like(bob)).data).toBe(true)
    let mine = (await posts(alice)).find((p) => p.id === id)
    expect(mine).toMatchObject({ like_count: 2, liked_by_me: true })

    expect((await like(alice)).data).toBe(false)
    mine = (await posts(alice)).find((p) => p.id === id)
    expect(mine).toMatchObject({ like_count: 1, liked_by_me: false })
  })

  it('rejects likes on a post from another event', async () => {
    const { error } = await guest.rpc('toggle_outfit_like', {
      p_code: 'NOPE0000',
      p_post_id: crypto.randomUUID(),
      p_token: newGuestToken(),
    })
    expect(error).not.toBeNull()
  })
})
