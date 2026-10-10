import { existsSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Tests run against the real Supabase project (there's no local stack),
// as the same anon/guest clients the app uses. Every test event is named
// TEST_EVENT_NAME, owned by a dedicated test host account, and deleted
// afterwards; globalSetup also sweeps up any a crashed run left behind.

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

function env(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to .env.local (or the CI secrets); see "Running the tests" in the README.`
    )
  }
  return value
}

export const TEST_EVENT_NAME = 'WAWW automated test'

const url = () => env('NEXT_PUBLIC_SUPABASE_URL')
const anonKey = () => env('NEXT_PUBLIC_SUPABASE_ANON_KEY')

// A logged-out browser: what every guest is.
export function anonClient(): SupabaseClient {
  return createClient(url(), anonKey(), { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function hostClient(): Promise<SupabaseClient> {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({
    email: env('TEST_HOST_EMAIL'),
    password: env('TEST_HOST_PASSWORD'),
  })
  if (error) throw new Error(`Test host sign-in failed: ${error.message}`)
  return client
}

// A per-browser guest token, like lib/guestIdentity's getGuestToken.
export const newGuestToken = () => crypto.randomUUID()

// Image URLs for posts that never touch storage. The database only stores
// them, so DB tests don't need real uploads.
export const fakeImage = (eventId: string, label: string) =>
  `https://example.invalid/storage/v1/object/public/outfit-posts/${eventId}/${crypto.randomUUID()}-${label}.jpg`

export type TestEvent = { id: string; code: string }

function inviteCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint32Array(8)), (b) => alphabet[b % alphabet.length]).join('')
}

export function daysFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function createTestEvent(
  host: SupabaseClient,
  fields: Record<string, unknown> = {}
): Promise<TestEvent> {
  const { data: user } = await host.auth.getUser()
  const { data, error } = await host
    .from('events')
    .insert({
      host_id: user.user!.id,
      host_display_name: 'Test Host',
      name: TEST_EVENT_NAME,
      event_date: daysFromToday(10),
      location: 'Test Hall',
      event_type: 'party',
      dress_code_text: 'Cocktail',
      invite_code: inviteCode(),
      ...fields,
    })
    .select('id, invite_code')
    .single()
  if (error) throw new Error(`Couldn't create test event: ${error.message}`)
  return { id: data.id, code: data.invite_code }
}

// Deletes the event (posts, polls, votes and likes cascade) plus any photos
// uploaded under it. Mirrors the app's delete order: list outfit photos
// while the host still owns the event, delete it, then remove the now
// unreferenced photos.
export async function deleteTestEvent(host: SupabaseClient, event: TestEvent): Promise<void> {
  const outfitPhotos = await listFiles(host, 'outfit-posts', event.id)
  const inspoPhotos = await listFiles(host, 'event-inspo', event.id)
  if (inspoPhotos.length) await host.storage.from('event-inspo').remove(inspoPhotos)
  const { error } = await host.from('events').delete().eq('id', event.id)
  if (error) throw new Error(`Couldn't delete test event ${event.code}: ${error.message}`)
  if (outfitPhotos.length) await host.storage.from('outfit-posts').remove(outfitPhotos)
}

async function listFiles(client: SupabaseClient, bucket: string, folder: string): Promise<string[]> {
  const { data } = await client.storage.from(bucket).list(folder, { limit: 1000 })
  return (data ?? []).map((f) => `${folder}/${f.name}`)
}

// Removes test events older than an hour, left by runs that crashed
// before cleaning up.
export async function sweepStaleTestEvents(): Promise<void> {
  const host = await hostClient()
  const cutoff = new Date(Date.now() - 3_600_000).toISOString()
  const { data } = await host
    .from('events')
    .select('id, invite_code')
    .eq('name', TEST_EVENT_NAME)
    .lt('created_at', cutoff)
  for (const e of data ?? []) await deleteTestEvent(host, { id: e.id, code: e.invite_code })
  await host.auth.signOut()
}
