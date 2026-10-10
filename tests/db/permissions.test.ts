import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  TEST_EVENT_NAME,
  anonClient,
  createTestEvent,
  deleteTestEvent,
  fakeImage,
  hostClient,
  newGuestToken,
  type TestEvent,
} from '../helpers'

// Guests reach data only through the invite-code functions. These check
// the walls around everything else.

let host: SupabaseClient
let event: TestEvent
const guest = anonClient()

beforeAll(async () => {
  host = await hostClient()
  event = await createTestEvent(host)
  await guest.rpc('insert_outfit_post', {
    p_code: event.code,
    p_display_name: 'Guest',
    p_image_url: fakeImage(event.id, 'outfit'),
    p_caption: null,
    p_guest_token: newGuestToken(),
    p_colors: [],
  })
})

afterAll(async () => {
  if (event) await deleteTestEvent(host, event)
})

describe('logged-out visitors', () => {
  it("can't read the events or posts tables directly", async () => {
    const events = await guest.from('events').select('id').eq('id', event.id)
    expect(events.data ?? []).toHaveLength(0)
    const posts = await guest.from('outfit_posts').select('id, guest_token').eq('event_id', event.id)
    expect(posts.data ?? []).toHaveLength(0)
  })

  it("can't read poll votes, options or likes directly", async () => {
    for (const table of ['outfit_poll_votes', 'outfit_poll_options', 'outfit_likes']) {
      const { data } = await guest.from(table).select('*').limit(1)
      expect(data ?? [], table).toHaveLength(0)
    }
  })

  it("can't create, edit or delete events", async () => {
    const insert = await guest
      .from('events')
      .insert({ host_id: crypto.randomUUID(), name: 'Sneaky', invite_code: 'SNEAKY01' })
    expect(insert.error).not.toBeNull()

    await guest.from('events').update({ name: 'Hacked' }).eq('id', event.id)
    await guest.from('events').delete().eq('id', event.id)
    const { data } = await guest.rpc('get_event_by_code', { p_code: event.code }).maybeSingle()
    expect(data).toMatchObject({ name: TEST_EVENT_NAME })
  })

  it("can't call account-only functions", async () => {
    expect((await guest.rpc('get_my_attending_events')).error).not.toBeNull()
    expect((await guest.rpc('poll_default_close', { p_event_date: '2030-01-01' })).error).not.toBeNull()
  })
})

describe('hosts', () => {
  it('see their own event and its posts', async () => {
    const { data: events } = await host.from('events').select('id').eq('id', event.id)
    expect(events).toHaveLength(1)
    const { data: posts } = await host.from('outfit_posts').select('id').eq('event_id', event.id)
    expect(posts!.length).toBeGreaterThan(0)
  })

  it("can't create an event for someone else", async () => {
    const { error } = await host
      .from('events')
      .insert({ host_id: crypto.randomUUID(), name: 'Not mine', invite_code: 'NOTMINE1', event_date: '2030-01-01' })
    expect(error).not.toBeNull()
  })
})
