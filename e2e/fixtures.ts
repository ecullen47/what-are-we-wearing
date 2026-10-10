import { test as base, expect } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createTestEvent, deleteTestEvent, hostClient, type TestEvent } from '../tests/helpers'

// A fresh test event per test, deleted afterwards along with any photos
// the test uploaded. (Playwright's fixture callback is usually named
// `use`; it's `provide` here so the React hooks lint rule leaves it alone.)
export const test = base.extend<{ host: SupabaseClient; event: TestEvent }>({
  host: async ({}, provide) => {
    const host = await hostClient()
    await provide(host)
    await host.auth.signOut()
  },
  event: async ({ host }, provide) => {
    const event = await createTestEvent(host)
    await provide(event)
    await deleteTestEvent(host, event)
  },
})

export { expect }

// A tiny PNG for file inputs; the app resizes and re-encodes it like any
// photo.
export function pngFile(name: string) {
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4/58BAAT/Af9xnBGnAAAAAElFTkSuQmCC'
  return { name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}
