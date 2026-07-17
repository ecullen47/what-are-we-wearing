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
    <div style={{ padding: '2rem', maxWidth: '400px' }}>
      <h1>Sign Up / Log In</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: 'block', marginBottom: '1rem', width: '100%', padding: '0.5rem' }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: 'block', marginBottom: '1rem', width: '100%', padding: '0.5rem' }}
      />
      <button onClick={handleSignUp} style={{ marginRight: '1rem' }}>Sign Up</button>
      <button onClick={handleLogIn}>Log In</button>
      <p>{message}</p>
    </div>
  )
}