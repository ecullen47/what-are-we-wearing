'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { daysUntil, formatEventDate } from '@/lib/formatDate'
import { toast } from '@/lib/toast'
import { eventTypeTint } from '@/lib/eventTypes'
import EventBadges from '@/components/EventBadges'
import HangerMark from '@/components/HangerMark'
import { DashboardSkeleton } from '@/components/Skeleton'

type EventSummary = {
  id: string
  name: string
  event_date: string
  location: string
  invite_code: string
  event_type: string | null
  inspo_image_urls: string[] | null
  outfit_posts: { count: number }[]
  latest: { image_url: string }[]
}

type AttendingEvent = {
  event_id: string
  name: string
  event_date: string
  location: string
  invite_code: string
  event_type: string | null
  cover_url: string | null
}

// Upcoming events first (soonest at the top), then past ones (most recent
// first), so the dashboard leads with what's next.
function byEventDate<T extends { event_date: string }>(list: T[]): T[] {
  const upcoming = list.filter((e) => (daysUntil(e.event_date) ?? 0) >= 0)
  const past = list.filter((e) => (daysUntil(e.event_date) ?? 0) < 0)
  upcoming.sort((a, b) => a.event_date.localeCompare(b.event_date))
  past.sort((a, b) => b.event_date.localeCompare(a.event_date))
  return [...upcoming, ...past]
}

function EventCard({
  href,
  name,
  date,
  location,
  type,
  coverUrl,
  action,
  children,
}: {
  href: string
  name: string
  date: string
  location: string
  type: string | null
  coverUrl: string | null
  // Rendered beside the link rather than inside it, since a button
  // nested in a link is invalid and would also trigger navigation.
  action?: React.ReactNode
  children?: React.ReactNode
}) {
  const past = (daysUntil(date) ?? 0) < 0
  return (
    <div className="relative">
      <Link
        href={href}
        className={`flex gap-4 rounded-xl border border-stone-line bg-white p-3 transition hover:border-terracotta hover:shadow-sm ${
          past ? 'opacity-75' : ''
        } ${action ? 'pr-20' : ''}`}
      >
        <div
          className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg ${eventTypeTint(type)}`}
        >
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <HangerMark className="h-9 w-9 opacity-70" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <EventBadges type={type} date={date} />
          <strong className="mt-1.5 block truncate font-display text-lg text-stone">
            {name?.trim() || 'Untitled event'}
          </strong>
          <p className="truncate text-sm text-stone-muted">
            {formatEventDate(date)}
            {location ? <> &middot; {location}</> : null}
          </p>
          {children}
        </div>
      </Link>
      {action && <div className="absolute top-3 right-3">{action}</div>}
    </div>
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
    setAttending(byEventDate((data as AttendingEvent[] | null) ?? []))
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user

      if (!user) {
        router.push('/login')
        return
      }

      // `latest` is the newest outfit photo, used as a cover when the event
      // has no inspo images.
      const { data } = await supabase
        .from('events')
        .select(
          'id, name, event_date, location, invite_code, event_type, inspo_image_urls, outfit_posts(count), latest:outfit_posts(image_url)'
        )
        .eq('host_id', user.id)
        .order('created_at', { referencedTable: 'latest', ascending: false })
        .limit(1, { referencedTable: 'latest' })

      setEvents(byEventDate((data as EventSummary[] | null) ?? []))
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
      setMessage('No event found with that code. Double-check it and try again.')
      setJoining(false)
      return
    }

    const name = (eventData as { name: string }).name?.trim() || 'That event'

    if (events?.some((e) => e.id === (eventData as { id: string }).id)) {
      setMessage(`"${name}" is your event, so it's already under Your Events.`)
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
    toast(`Added "${name}" to Attending`)
    await loadAttending()
    setJoining(false)
  }

  const handleLeave = async (eventId: string, eventName: string) => {
    const name = eventName?.trim() || 'this event'
    if (!window.confirm(`Leave "${name}"? It will be removed from your Attending list.`)) return

    const { error } = await supabase.from('event_attendance').delete().eq('event_id', eventId)
    if (error) {
      setMessage(`Error: ${error.message}`)
      return
    }

    toast(`Left "${name}"`)
    await loadAttending()
  }

  if (events === null) {
    return <DashboardSkeleton />
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
        <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-stone-line bg-linear-to-br from-blush/60 via-cream to-sage/60 px-6 py-10 text-center">
          <HangerMark className="h-12 w-12 text-terracotta" />
          <p className="mt-3 font-display text-xl text-stone">No events yet</p>
          <p className="mt-1 max-w-xs text-sm text-stone-muted">
            Hosting something? Set the dress code, pick the colors, and share one link.
          </p>
          <Link
            href="/create-event"
            className="mt-5 rounded-full bg-terracotta px-5 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-dark"
          >
            Create your first event
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {events.map((event) => {
            const count = event.outfit_posts?.[0]?.count ?? 0
            return (
              <EventCard
                key={event.id}
                href={`/event/${event.invite_code}`}
                name={event.name}
                date={event.event_date}
                location={event.location}
                type={event.event_type}
                coverUrl={event.inspo_image_urls?.[0] ?? event.latest?.[0]?.image_url ?? null}
              >
                <p className="mt-1 text-xs text-stone-muted">
                  Code <strong className="tracking-wide text-stone">{event.invite_code}</strong> &middot; {count}{' '}
                  outfit{count === 1 ? '' : 's'} posted
                </p>
              </EventCard>
            )
          })}
        </div>
      )}

      <h2 className="mt-12 font-display text-2xl text-stone">Attending</h2>
      {attending.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-stone-line bg-white/60 px-5 py-6 text-center text-sm text-stone-muted">
          Got an invite code? Pop it in above and the event lands here, so you can find it again.
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
              type={event.event_type}
              coverUrl={event.cover_url}
              action={
                <button
                  onClick={() => handleLeave(event.event_id, event.name)}
                  className="rounded-full border border-stone-line bg-white px-3 py-1 text-xs font-medium text-stone-muted transition-colors hover:border-terracotta hover:text-terracotta"
                >
                  Leave
                </button>
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
