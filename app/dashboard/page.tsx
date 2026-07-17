'use client'

import { useEffect, useState } from 'react'
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

export default function DashboardPage() {
  const router = useRouter()
  const [events, setEvents] = useState<EventSummary[] | null>(null)

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
    }

    load()
  }, [router])

  if (events === null) {
    return <div style={{ padding: '2rem' }}>Loading...</div>
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Your Events</h1>
        <Link href="/create-event">+ Create New Event</Link>
      </div>

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
              <p style={{ margin: 0, fontSize: '0.875rem' }}>
                {event.outfit_posts?.[0]?.count ?? 0} outfit
                {event.outfit_posts?.[0]?.count === 1 ? '' : 's'} posted
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
