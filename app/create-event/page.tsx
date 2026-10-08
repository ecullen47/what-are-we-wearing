'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// No 0/O or 1/I/L, so codes are easy to read aloud and type from a text.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6
const MAX_CODE_ATTEMPTS = 5

function generateInviteCode() {
  const bytes = new Uint32Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

function todayLocalISO() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

type FieldErrors = Partial<Record<'hostDisplayName' | 'name' | 'eventDate' | 'location', string>>

const inputBase =
  'block w-full rounded-md border bg-white px-4 py-2 text-stone placeholder:text-stone-muted focus:outline-none'
const inputOk = 'border-stone-line focus:border-terracotta'
const inputErr = 'border-terracotta-dark focus:border-terracotta-dark'
const labelClass = 'mb-1 block text-sm font-medium text-stone'
const errorClass = 'mt-1 text-xs text-terracotta-dark'

export default function CreateEventPage() {
  const [hostDisplayName, setHostDisplayName] = useState('')
  const [name, setName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState('')
  const [eventType, setEventType] = useState('wedding')
  const [dressCode, setDressCode] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  const validate = (): FieldErrors => {
    const next: FieldErrors = {}
    if (!hostDisplayName.trim()) next.hostDisplayName = 'Please enter your name.'
    if (!name.trim()) next.name = 'Please give your event a name.'
    if (!eventDate) next.eventDate = 'Please pick a date.'
    else if (eventDate < todayLocalISO()) next.eventDate = 'That date is in the past.'
    if (!location.trim()) next.location = 'Please add a location.'
    return next
  }

  const clearError = (field: keyof FieldErrors) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async () => {
    if (submitting) return
    setMessage('')

    const fieldErrors = validate()
    setErrors(fieldErrors)
    if (Object.values(fieldErrors).some(Boolean)) return

    setSubmitting(true)

    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) {
      setMessage('You must be logged in to create an event.')
      setSubmitting(false)
      return
    }

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const { data, error } = await supabase
        .from('events')
        .insert({
          host_id: user.id,
          host_display_name: hostDisplayName.trim(),
          name: name.trim(),
          event_date: eventDate,
          location: location.trim(),
          event_type: eventType,
          dress_code_text: dressCode.trim(),
          invite_code: generateInviteCode(),
        })
        .select('invite_code')
        .single()

      if (!error) {
        router.push(`/event/${data.invite_code}/setup`)
        return
      }

      // 23505 = unique_violation: the invite code was taken, try another.
      if (error.code !== '23505') {
        setMessage(`Error: ${error.message}`)
        setSubmitting(false)
        return
      }
    }

    setMessage('Something went wrong creating your invite code. Please try again.')
    setSubmitting(false)
  }

  const field = (key: keyof FieldErrors) => `${inputBase} ${errors[key] ? inputErr : inputOk}`
  const plain = `${inputBase} ${inputOk}`

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <Link href="/dashboard" className="text-sm text-terracotta hover:underline">
        &larr; Back to Dashboard
      </Link>
      <h1 className="mt-3 font-display text-3xl text-stone">Create an Event</h1>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
      >
        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="host" className={labelClass}>
              Your Name
            </label>
            <input
              id="host"
              value={hostDisplayName}
              onChange={(e) => {
                setHostDisplayName(e.target.value)
                clearError('hostDisplayName')
              }}
              placeholder="Shown to guests as the host"
              className={field('hostDisplayName')}
            />
            {errors.hostDisplayName && <p className={errorClass}>{errors.hostDisplayName}</p>}
          </div>

          <div>
            <label htmlFor="name" className={labelClass}>
              Event Name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                clearError('name')
              }}
              placeholder="e.g. Sarah & Tom's Wedding"
              className={field('name')}
            />
            {errors.name && <p className={errorClass}>{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="date" className={labelClass}>
              Date
            </label>
            <input
              id="date"
              type="date"
              min={todayLocalISO()}
              value={eventDate}
              onChange={(e) => {
                setEventDate(e.target.value)
                clearError('eventDate')
              }}
              className={field('eventDate')}
            />
            {errors.eventDate && <p className={errorClass}>{errors.eventDate}</p>}
          </div>

          <div>
            <label htmlFor="location" className={labelClass}>
              Location
            </label>
            <input
              id="location"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value)
                clearError('location')
              }}
              className={field('location')}
            />
            {errors.location && <p className={errorClass}>{errors.location}</p>}
          </div>

          <div>
            <label htmlFor="type" className={labelClass}>
              Event Type
            </label>
            <select id="type" value={eventType} onChange={(e) => setEventType(e.target.value)} className={plain}>
              <option value="wedding">Wedding</option>
              <option value="dinner">Dinner</option>
              <option value="party">Party</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="dress" className={labelClass}>
              Dress Code <span className="font-normal text-stone-muted">(optional)</span>
            </label>
            <input
              id="dress"
              value={dressCode}
              onChange={(e) => setDressCode(e.target.value)}
              placeholder='e.g. "cocktail attire"'
              className={plain}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 rounded-full bg-terracotta px-6 py-2.5 font-medium text-cream transition-colors hover:bg-terracotta-dark disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Event'}
        </button>
        {message && <p className="mt-3 text-sm text-stone-muted">{message}</p>}
      </form>
    </div>
  )
}
