import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/db/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    // Every call is a network round trip to Supabase.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
