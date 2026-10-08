'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const inputClass =
  'mt-3 w-full rounded-md border border-stone-line bg-white px-4 py-2.5 text-stone placeholder:text-stone-muted focus:border-terracotta focus:outline-none'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  // The link in the reset email carries a one-time token. The Supabase
  // client exchanges it for a session automatically on load, so by the
  // time getSession resolves we either have a session or the link was bad.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? 'ready' : 'invalid')
    })
  }, [])

  const handleSave = async () => {
    setMessage('')
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setMessage("Passwords don't match.")
      return
    }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMessage(`Error: ${error.message}`)
      setSaving(false)
      return
    }
    router.push('/dashboard')
  }

  return (
    <div className="mx-auto flex max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-display text-3xl text-stone">Reset Password</h1>

      {status === 'checking' && <p className="mt-4 text-stone-muted">Loading...</p>}

      {status === 'invalid' && (
        <>
          <p className="mt-4 text-stone-muted">
            This reset link is invalid or has expired. Request a new one from the login page.
          </p>
          <Link href="/login" className="mt-4 text-sm text-terracotta hover:underline">
            &larr; Back to login
          </Link>
        </>
      )}

      {status === 'ready' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
        >
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={saving}
            className="mt-5 w-full rounded-full bg-terracotta px-5 py-2.5 font-medium text-cream transition-colors hover:bg-terracotta-dark disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save New Password'}
          </button>
          {message && <p className="mt-4 text-sm text-stone-muted">{message}</p>}
        </form>
      )}
    </div>
  )
}
