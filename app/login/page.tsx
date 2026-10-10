'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { safeNextPath } from '@/lib/createPrefill'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  // Where to go after logging in, e.g. back to a prefilled create page.
  const [next, setNext] = useState<string | null>(null)
  const router = useRouter()

  // Already logged in (e.g. via the homepage's "Create an Event" button):
  // skip the form and go straight on.
  useEffect(() => {
    const target = safeNextPath(new URLSearchParams(window.location.search).get('next'))
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(target ?? '/dashboard')
      else setNext(target)
    })
  }, [router])

  const handleSignUp = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMessage(`Error: ${error.message}`)
    } else if (data.session) {
      // No email confirmation required, so they're already logged in.
      router.push(next ?? '/dashboard')
    } else {
      setMessage('Signed up! Check your email if confirmation is required, or try logging in.')
    }
  }

  const handleLogIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      router.push(next ?? '/dashboard')
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setMessage('Enter your email above, then click "Forgot password?" again.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      // Same message whether or not the account exists, so this can't be
      // used to check which emails are registered.
      setMessage('If an account exists for that email, a password reset link is on its way.')
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-display text-3xl text-stone">Sign Up / Log In</h1>
      <p className="mt-2 text-sm text-stone-muted">
        {next?.startsWith('/create-event')
          ? 'Log in or sign up to finish creating your event. Your details will be waiting.'
          : <>Hosts need an account &mdash; guests never do.</>}
      </p>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-6 w-full rounded-md border border-stone-line bg-white px-4 py-2.5 text-stone placeholder:text-stone-muted focus:border-terracotta focus:outline-none"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-3 w-full rounded-md border border-stone-line bg-white px-4 py-2.5 text-stone placeholder:text-stone-muted focus:border-terracotta focus:outline-none"
      />

      <div className="mt-5 flex gap-3">
        <button
          onClick={handleLogIn}
          className="flex-1 rounded-full bg-terracotta px-5 py-2.5 font-medium text-cream transition-colors hover:bg-terracotta-dark"
        >
          Log In
        </button>
        <button
          onClick={handleSignUp}
          className="flex-1 rounded-full border border-terracotta px-5 py-2.5 font-medium text-terracotta transition-colors hover:bg-terracotta-light"
        >
          Sign Up
        </button>
      </div>

      <button
        onClick={handleForgotPassword}
        className="mt-4 self-start text-sm text-stone-muted underline decoration-stone-line underline-offset-4 hover:text-terracotta"
      >
        Forgot password?
      </button>

      {message && <p className="mt-4 text-sm text-stone-muted">{message}</p>}
    </div>
  )
}
