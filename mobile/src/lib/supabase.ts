import { store } from './localStore'
import { AppState } from 'react-native'
import { createClient } from '@supabase/supabase-js'

// Same Supabase project and anon key as the web app. Guests never sign in;
// everything they do goes through the invite-code functions.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
if (!url || !anonKey) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env.local')
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: store,
    autoRefreshToken: true,
    persistSession: true,
    // Phones have no URL to read a session from.
    detectSessionInUrl: false,
  },
})

// Only refresh tokens while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})
