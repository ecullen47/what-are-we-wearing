import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { anonClient, createTestEvent, deleteTestEvent, hostClient, newGuestToken, fakeImage, type TestEvent } from '../helpers'

// The co-host side needs a second account. Add TEST_COHOST_EMAIL and
// TEST_COHOST_PASSWORD (a normal account used only for tests) to run it.
const cohostEmail = process.env.TEST_COHOST_EMAIL
const cohostPassword = process.env.TEST_COHOST_PASSWORD

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

describe('co-host invite links (owner side)', () => {
  it('lets the owner make a link that anyone can preview but only a signed-in user can use', async () => {
    const { data: token, error } = await host.rpc('create_cohost_invite', { p_event_id: event.id })
    expect(error).toBeNull()

    const { data: preview } = await guest.rpc('get_cohost_invite', { p_token: token }).maybeSingle()
    expect(preview).toMatchObject({ host_display_name: 'Test Host' })

    const { error: anonAccept } = await guest.rpc('accept_cohost_invite', { p_token: token })
    expect(anonAccept).not.toBeNull()

    // The owner opening their own link just gets the event back.
    const { data: code } = await host.rpc('accept_cohost_invite', { p_token: token })
    expect(code).toBe(event.code)
    const { data: cohosts } = await host.from('event_cohosts').select('user_id').eq('event_id', event.id)
    expect(cohosts).toEqual([])
  })

  it('stops an old link working when the owner makes a new one or turns it off', async () => {
    const { data: first } = await host.rpc('create_cohost_invite', { p_event_id: event.id })
    const { data: second } = await host.rpc('create_cohost_invite', { p_event_id: event.id })
    expect(second).not.toBe(first)
    expect((await guest.rpc('get_cohost_invite', { p_token: first })).data).toEqual([])

    await host.rpc('revoke_cohost_invite', { p_event_id: event.id })
    expect((await guest.rpc('get_cohost_invite', { p_token: second })).data).toEqual([])
  })

  it("won't let a guest make a link, or anyone change the event's owner", async () => {
    const { error: guestInvite } = await guest.rpc('create_cohost_invite', { p_event_id: event.id })
    expect(guestInvite).not.toBeNull()

    const { error: takeover } = await host
      .from('events')
      .update({ host_id: crypto.randomUUID() })
      .eq('id', event.id)
    expect(takeover?.message).toMatch(/owner can't be changed/)
  })
})

describe.skipIf(!cohostEmail || !cohostPassword)('co-hosting (needs a second test account)', () => {
  let cohost: SupabaseClient

  beforeAll(async () => {
    cohost = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await cohost.auth.signInWithPassword({ email: cohostEmail!, password: cohostPassword! })
    if (error) throw new Error(`Test co-host sign-in failed: ${error.message}`)
  })

  afterAll(async () => {
    await cohost?.auth.signOut({ scope: 'local' })
  })

  it('can do what the host does, except delete the event or invite others', async () => {
    // Before joining, the event is invisible to them.
    expect((await cohost.from('events').select('id').eq('id', event.id)).data).toEqual([])

    const { data: token } = await host.rpc('create_cohost_invite', { p_event_id: event.id })
    const { data: code, error } = await cohost.rpc('accept_cohost_invite', { p_token: token })
    expect(error).toBeNull()
    expect(code).toBe(event.code)

    const { data: listed } = await host.from('event_cohosts').select('email').eq('event_id', event.id)
    expect(listed).toEqual([{ email: cohostEmail!.toLowerCase() }])

    // Edit the event and pin a note.
    const { error: editError } = await cohost
      .from('events')
      .update({ dress_code_text: 'Black tie', host_note: 'From the co-host' })
      .eq('id', event.id)
    expect(editError).toBeNull()

    // Remove a guest's post.
    const { data: postId } = await guest.rpc('insert_outfit_post', {
      p_code: event.code,
      p_display_name: 'Guest',
      p_image_url: fakeImage(event.id, 'outfit'),
      p_caption: null,
      p_guest_token: newGuestToken(),
      p_colors: [],
    })
    await cohost.from('outfit_posts').delete().eq('id', postId)
    expect((await host.from('outfit_posts').select('id').eq('id', postId)).data).toEqual([])

    // Not: delete the event, make invite links, or take ownership.
    await cohost.from('events').delete().eq('id', event.id)
    expect((await host.from('events').select('id').eq('id', event.id)).data).toHaveLength(1)
    expect((await cohost.rpc('create_cohost_invite', { p_event_id: event.id })).error).not.toBeNull()
    const { data: me } = await cohost.auth.getUser()
    const { error: takeover } = await cohost.from('events').update({ host_id: me.user!.id }).eq('id', event.id)
    expect(takeover).not.toBeNull()
  })

  it('can leave, and the owner can remove them', async () => {
    const { data: me } = await cohost.auth.getUser()
    const { data: token } = await host.rpc('create_cohost_invite', { p_event_id: event.id })
    await cohost.rpc('accept_cohost_invite', { p_token: token })

    await host.from('event_cohosts').delete().eq('event_id', event.id).eq('user_id', me.user!.id)
    expect((await cohost.from('events').select('id').eq('id', event.id)).data).toEqual([])

    await cohost.rpc('accept_cohost_invite', { p_token: token })
    await cohost.from('event_cohosts').delete().eq('event_id', event.id).eq('user_id', me.user!.id)
    expect((await cohost.from('events').select('id').eq('id', event.id)).data).toEqual([])
  })
})
