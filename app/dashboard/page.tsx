'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type EventSummary = {
  id: string
  name: string
  event_date: string
  location: string
  invite_code: string
  outfit_posts: { count: number }[]
}

type AttendingEvent = {
  event_id: string
  name: string
  event_date: string
  location: string
  invite_code: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [events, setEvents] = useState<EventSummary[] | null>(null)
  const [attending, setAttending] = useState<AttendingEvent[]>([])
  const [eventCode, setEventCode] = useState('')
  const [message, setMessage] = useState('')
  const [joining, setJoining] = useState(false)

  const loadAttending = useCallback(async () => {
    const { data } = await supabase.rpc('get_my_attending_events')
    setAttending((data as AttendingEvent[] | null) ?? [])
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user

      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('events')
        .select('id, name, event_date, location, invite_code, outfit_posts(count)')
        .eq('host_id', user.id)
        .order('created_at', { ascending: false })

      setEvents((data as EventSummary[] | null) ?? [])
      await loadAttending()
    }

    load()
  }, [router, loadAttending])

  const handleGoToEvent = async () => {
    const code = eventCode.trim().toUpperCase()
    if (!code) return

    setJoining(true)
    setMessage('')

    const { data: eventData, error: eventError } = await supabase
      .rpc('get_event_by_code', { p_code: code })
      .single()

    if (eventError || !eventData) {
      setMessage('No event found with that code.')
      setJoining(false)
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) {
      router.push('/login')
      return
    }

    const { error: joinError } = await supabase
      .from('event_attendance')
      .upsert(
        { event_id: (eventData as { id: string }).id, user_id: user.id },
        { onConflict: 'event_id,user_id', ignoreDuplicates: true }
      )

    if (joinError) {
      setMessage(`Error: ${joinError.message}`)
      setJoining(false)
      return
    }

    setEventCode('')
    setMessage(`Added "${(eventData as { name: string }).name}" to Attending.`)
    await loadAttending()
    setJoining(false)
  }

  if (events === null) {
    return <div style={{ padding: '2rem' }}>Loading...</div>
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Your Events</h1>
        <Link href="/create-event">+ Create New Event</Link>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
        <input
          value={eventCode}
          onChange={(e) => setEventCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleGoToEvent()
          }}
          placeholder="Have an invite code? Enter it here"
          style={{ flex: 1, padding: '0.5rem' }}
        />
        <button onClick={handleGoToEvent} disabled={joining}>
          {joining ? 'Adding...' : 'Go'}
        </button>
      </div>
      {message && <p style={{ fontSize: '0.875rem' }}>{message}</p>}

      {events.length === 0 ? (
        <p>You haven&apos;t created any events yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/event/${event.invite_code}`}
              style={{
                display: 'block',
                padding: '1rem',
                border: '1px solid #ddd',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <strong>{event.name}</strong>
              <p style={{ margin: '0.25rem 0' }}>
                {event.event_date} &middot; {event.location}
              </p>
              <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                Invite code: <strong>{event.invite_code}</strong>
              </p>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>
                {event.outfit_posts?.[0]?.count ?? 0} outfit
                {event.outfit_posts?.[0]?.count === 1 ? '' : 's'} posted
              </p>
            </Link>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: '2rem' }}>Attending</h2>
      {attending.length === 0 ? (
        <p>You&apos;re not attending any events yet. Enter an invite code above to join one.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          {attending.map((event) => (
            <Link
              key={event.event_id}
              href={`/event/${event.invite_code}`}
              style={{
                display: 'block',
                padding: '1rem',
                border: '1px solid #ddd',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <strong>{event.name}</strong>
              <p style={{ margin: '0.25rem 0' }}>
                {event.event_date} &middot; {event.location}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
