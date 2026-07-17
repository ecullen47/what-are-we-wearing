'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Signed up! Check your email if confirmation is required, or try logging in.')
    }
  }

  const handleLogIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-display text-3xl text-stone">Sign Up / Log In</h1>
      <p className="mt-2 text-sm text-stone-muted">Hosts need an account &mdash; guests never do.</p>

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

      {message && <p className="mt-4 text-sm text-stone-muted">{message}</p>}
    </div>
  )
}
