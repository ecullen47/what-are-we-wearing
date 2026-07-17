'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

const inputClass =
  'block w-full rounded-md border border-stone-line bg-white px-4 py-2 text-stone placeholder:text-stone-muted focus:border-terracotta focus:outline-none'
const labelClass = 'mb-1 block text-sm font-medium text-stone'

export default function CreateEventPage() {
  const [hostDisplayName, setHostDisplayName] = useState('')
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

    if (!hostDisplayName.trim()) {
      setMessage('Please enter your name.')
      return
    }

    const inviteCode = generateInviteCode()

    const { data, error } = await supabase
      .from('events')
      .insert({
        host_id: user.id,
        host_display_name: hostDisplayName.trim(),
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
    <div className="mx-auto max-w-lg px-6 py-12">
      <Link href="/dashboard" className="text-sm text-terracotta hover:underline">
        &larr; Back to Dashboard
      </Link>
      <h1 className="mt-3 font-display text-3xl text-stone">Create an Event</h1>

      <div className="mt-6 space-y-4">
        <div>
          <label className={labelClass}>Your Name</label>
          <input
            value={hostDisplayName}
            onChange={(e) => setHostDisplayName(e.target.value)}
            placeholder="Shown to guests as the host"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Event Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Date</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Event Type</label>
          <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={inputClass}>
            <option value="wedding">Wedding</option>
            <option value="dinner">Dinner</option>
            <option value="party">Party</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Dress Code</label>
          <input
            value={dressCode}
            onChange={(e) => setDressCode(e.target.value)}
            placeholder='e.g. "cocktail attire"'
            className={inputClass}
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        className="mt-6 rounded-full bg-terracotta px-6 py-2.5 font-medium text-cream transition-colors hover:bg-terracotta-dark"
      >
        Create Event
      </button>
      {message && <p className="mt-3 text-sm text-stone-muted">{message}</p>}
    </div>
  )
}
