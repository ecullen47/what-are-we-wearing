'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function CreateEventPage() {
  const [name, setName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState('')
  const [eventType, setEventType] = useState('wedding')
  const [dressCode, setDressCode] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleSubmit = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user

    if (!user) {
      setMessage('You must be logged in to create an event.')
      return
    }

    const inviteCode = generateInviteCode()

    const { data, error } = await supabase
      .from('events')
      .insert({
        host_id: user.id,
        name,
        event_date: eventDate,
        location,
        event_type: eventType,
        dress_code_text: dressCode,
        invite_code: inviteCode,
      })
      .select()
      .single()

    if (error) {
      setMessage(`Error: ${error.message}`)
      return
    }

    router.push(`/event/${data.invite_code}/setup`)
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '500px' }}>
      <Link href="/dashboard">&larr; Back to Dashboard</Link>
      <h1>Create an Event</h1>

      <label>Event Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ display: 'block', marginBottom: '1rem', width: '100%', padding: '0.5rem' }}
      />

      <label>Date</label>
      <input
        type="date"
        value={eventDate}
        onChange={(e) => setEventDate(e.target.value)}
        style={{ display: 'block', marginBottom: '1rem', width: '100%', padding: '0.5rem' }}
      />

      <label>Location</label>
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        style={{ display: 'block', marginBottom: '1rem', width: '100%', padding: '0.5rem' }}
      />

      <label>Event Type</label>
      <select
        value={eventType}
        onChange={(e) => setEventType(e.target.value)}
        style={{ display: 'block', marginBottom: '1rem', width: '100%', padding: '0.5rem' }}
      >
        <option value="wedding">Wedding</option>
        <option value="dinner">Dinner</option>
        <option value="party">Party</option>
        <option value="other">Other</option>
      </select>

      <label>Dress Code</label>
      <input
        value={dressCode}
        onChange={(e) => setDressCode(e.target.value)}
        placeholder='e.g. "cocktail attire"'
        style={{ display: 'block', marginBottom: '1rem', width: '100%', padding: '0.5rem' }}
      />

      <button onClick={handleSubmit}>Create Event</button>
      <p>{message}</p>
    </div>
  )
}