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

function EventCard({
  href,
  name,
  date,
  location,
  children,
}: {
  href: string
  name: string
  date: string
  location: string
  children?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-stone-line bg-white p-4 transition-colors hover:border-terracotta"
    >
      <strong className="font-display text-lg text-stone">{name}</strong>
      <p className="mt-1 text-sm text-stone-muted">
        {date} &middot; {location}
      </p>
      {children}
    </Link>
  )
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
    return <div className="px-6 py-16 text-center text-stone-muted">Loading...</div>
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-stone">Your Events</h1>
        <Link
          href="/create-event"
          className="shrink-0 rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-dark"
        >
          + Create New Event
        </Link>
      </div>

      <div className="mt-6 flex gap-2">
        <input
          value={eventCode}
          onChange={(e) => setEventCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleGoToEvent()
          }}
          placeholder="Have an invite code? Enter it here"
          className="min-w-0 flex-1 rounded-md border border-stone-line bg-white px-4 py-2 text-stone placeholder:text-stone-muted focus:border-terracotta focus:outline-none"
        />
        <button
          onClick={handleGoToEvent}
          disabled={joining}
          className="shrink-0 rounded-md border border-terracotta px-4 py-2 text-sm font-medium text-terracotta transition-colors hover:bg-terracotta-light disabled:opacity-50"
        >
          {joining ? 'Adding...' : 'Go'}
        </button>
      </div>
      {message && <p className="mt-2 text-sm text-stone-muted">{message}</p>}

      {events.length === 0 ? (
        <p className="mt-6 text-stone-muted">You haven&apos;t created any events yet.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              href={`/event/${event.invite_code}`}
              name={event.name}
              date={event.event_date}
              location={event.location}
            >
              <p className="mt-2 text-sm text-stone-muted">
                Invite code: <strong className="text-stone">{event.invite_code}</strong>
              </p>
              <p className="mt-1 text-sm text-stone-muted">
                {event.outfit_posts?.[0]?.count ?? 0} outfit
                {event.outfit_posts?.[0]?.count === 1 ? '' : 's'} posted
              </p>
            </EventCard>
          ))}
        </div>
      )}

      <h2 className="mt-10 font-display text-2xl text-stone">Attending</h2>
      {attending.length === 0 ? (
        <p className="mt-4 text-stone-muted">
          You&apos;re not attending any events yet. Enter an invite code above to join one.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {attending.map((event) => (
            <EventCard
              key={event.event_id}
              href={`/event/${event.invite_code}`}
              name={event.name}
              date={event.event_date}
              location={event.location}
            />
          ))}
        </div>
      )}
    </div>
  )
}
