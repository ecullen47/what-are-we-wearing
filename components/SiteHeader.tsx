'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Shown on every page. Tracks the auth session so the right links appear
// immediately after logging in or out anywhere in the app.
export default function SiteHeader() {
  const router = useRouter()
  // null = still checking, so we don't flash the wrong links on load.
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setLoggedIn(!!session))
    return () => sub.subscription.unsubscribe()
  }, [])

  const handleLogOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const linkClass = 'text-sm text-stone-muted transition-colors hover:text-terracotta'

  return (
    <header className="border-b border-stone-line/70 bg-cream/90 backdrop-blur">
      <div className="h-1 bg-linear-to-r from-blush via-butter via-50% to-sky" aria-hidden="true" />
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="font-display text-lg leading-none text-stone">
          What Are We <span className="text-terracotta">Wearing?</span>
        </Link>
        <nav className="flex min-h-[1.25rem] items-center gap-5">
          {loggedIn === true && (
            <>
              <Link href="/dashboard" className={linkClass}>
                Dashboard
              </Link>
              <button onClick={handleLogOut} className={linkClass}>
                Log out
              </button>
            </>
          )}
          {loggedIn === false && (
            <Link href="/login" className={linkClass}>
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
