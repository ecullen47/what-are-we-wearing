'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatEventDate } from '@/lib/formatDate'
import HangerMark from '@/components/HangerMark'

type Invite = { event_name: string | null; event_date: string | null; host_display_name: string | null }

// Where a host's private co-host link lands. Shows which event it's for,
// sends logged-out visitors to log in (or sign up) and back, then joins
// them with one click.
export default function CoHostInvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'invalid'>('loading')
  const [loggedIn, setLoggedIn] = useState(false)
  const [joining, setJoining] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const load = async () => {
      const [{ data }, { data: session }] = await Promise.all([
        supabase.rpc('get_cohost_invite', { p_token: token }).maybeSingle(),
        supabase.auth.getSession(),
      ])
      setLoggedIn(!!session.session)
      if (!data) {
        setState('invalid')
        return
      }
      setInvite(data as Invite)
      setState('ready')
    }
    load()
  }, [token])

  const join = async () => {
    setJoining(true)
    setMessage('')
    const { data: code, error } = await supabase.rpc('accept_cohost_invite', { p_token: token })
    if (error || !code) {
      setMessage(error?.message ?? 'Something went wrong. Please try again.')
      setJoining(false)
      return
    }
    router.push(`/event/${code}`)
  }

  if (state === 'loading') return <div className="flex-1" />

  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <HangerMark className="mx-auto h-12 w-12 text-terracotta" />
      {state === 'invalid' || !invite ? (
        <>
          <h1 className="mt-4 font-display text-3xl text-stone">This link has expired</h1>
          <p className="mt-2 text-stone-muted">Ask the host to send you a new co-host link.</p>
        </>
      ) : (
        <>
          <p className="mt-4 text-xs font-medium tracking-[0.18em] text-terracotta uppercase">
            {invite.host_display_name ? `${invite.host_display_name} invited you to co-host` : "You're invited to co-host"}
          </p>
          <h1 className="mt-2 font-display text-3xl text-stone">{invite.event_name?.trim() || 'An event'}</h1>
          {invite.event_date && <p className="mt-1 text-stone-muted">{formatEventDate(invite.event_date)}</p>}
          <p className="mt-4 text-sm text-stone-muted">
            Co-hosts can edit the event&apos;s details, inspo and colors, pin updates for guests and remove posts.
          </p>
          {loggedIn ? (
            <button
              onClick={join}
              disabled={joining}
              className="mt-6 rounded-full bg-terracotta px-6 py-2.5 font-medium text-cream transition-colors hover:bg-terracotta-dark disabled:opacity-50"
            >
              {joining ? 'Joining...' : 'Join as co-host'}
            </button>
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(`/cohost/${token}`)}`}
              className="mt-6 inline-block rounded-full bg-terracotta px-6 py-2.5 font-medium text-cream transition-colors hover:bg-terracotta-dark"
            >
              Log in or sign up to join
            </Link>
          )}
          {message && <p className="mt-3 text-sm text-terracotta-dark">{message}</p>}
        </>
      )}
    </div>
  )
}
