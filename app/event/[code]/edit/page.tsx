'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { listEventFiles, removeEventImages, uploadEventImage } from '@/lib/uploadImage'

type EventRow = {
  id: string
  host_id: string
  invite_code: string
  host_display_name: string | null
  name: string
  event_date: string
  location: string
  event_type: string
  dress_code_text: string | null
  inspo_image_urls: string[] | null
  required_colors: string[] | null
  suggested_colors: string[] | null
  off_limit_colors: string[] | null
  show_invite_code_to_guests: boolean
}

type FieldErrors = Partial<Record<'hostDisplayName' | 'name' | 'eventDate' | 'location', string>>

const INSPO_BUCKET = 'event-inspo'

function parseColorList(input: string): string[] {
  return input
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
}

function todayLocalISO() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

const inputBase =
  'block w-full rounded-md border bg-white px-4 py-2 text-stone placeholder:text-stone-muted focus:outline-none'
const inputOk = 'border-stone-line focus:border-terracotta'
const inputErr = 'border-terracotta-dark focus:border-terracotta-dark'
const labelClass = 'mb-1 block text-sm font-medium text-stone'
const errorClass = 'mt-1 text-xs text-terracotta-dark'
const sectionTitle = 'font-display text-xl text-stone'

export default function EditEventPage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()

  const [event, setEvent] = useState<EventRow | null>(null)
  const [loading, setLoading] = useState(true)

  const [hostDisplayName, setHostDisplayName] = useState('')
  const [name, setName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState('')
  const [eventType, setEventType] = useState('wedding')
  const [dressCode, setDressCode] = useState('')
  const [keptInspo, setKeptInspo] = useState<string[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [requiredColors, setRequiredColors] = useState('')
  const [suggestedColors, setSuggestedColors] = useState('')
  const [offLimitColors, setOffLimitColors] = useState('')
  const [showInviteCode, setShowInviteCode] = useState(true)

  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user

      const { data, error } = await supabase
        .from('events')
        .select(
          'id, host_id, invite_code, host_display_name, name, event_date, location, event_type, dress_code_text, inspo_image_urls, required_colors, suggested_colors, off_limit_colors, show_invite_code_to_guests'
        )
        .eq('invite_code', code)
        .maybeSingle()

      if (error || !data || !user || data.host_id !== user.id) {
        router.push(`/event/${code}`)
        return
      }

      const row = data as EventRow
      setEvent(row)
      setHostDisplayName(row.host_display_name ?? '')
      setName(row.name ?? '')
      setEventDate(row.event_date ?? '')
      setLocation(row.location ?? '')
      setEventType(row.event_type || 'other')
      setDressCode(row.dress_code_text ?? '')
      setKeptInspo(row.inspo_image_urls ?? [])
      setRequiredColors((row.required_colors ?? []).join(', '))
      setSuggestedColors((row.suggested_colors ?? []).join(', '))
      setOffLimitColors((row.off_limit_colors ?? []).join(', '))
      setShowInviteCode(row.show_invite_code_to_guests)
      setLoading(false)
    }

    load()
  }, [code, router])

  const validate = (): FieldErrors => {
    const next: FieldErrors = {}
    if (!hostDisplayName.trim()) next.hostDisplayName = 'Please enter your name.'
    if (!name.trim()) next.name = 'Please give your event a name.'
    if (!eventDate) next.eventDate = 'Please pick a date.'
    // Only block past dates if the host changed it; an event that has already
    // happened should still be editable without forcing a new date.
    else if (eventDate !== event?.event_date && eventDate < todayLocalISO())
      next.eventDate = 'That date is in the past.'
    if (!location.trim()) next.location = 'Please add a location.'
    return next
  }

  const clearError = (field: keyof FieldErrors) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSave = async () => {
    if (!event || saving) return
    setMessage('')

    const fieldErrors = validate()
    setErrors(fieldErrors)
    if (Object.values(fieldErrors).some(Boolean)) {
      setMessage('Please fix the highlighted fields.')
      return
    }

    setSaving(true)

    try {
      const uploaded: string[] = []
      for (const file of newFiles) {
        uploaded.push(await uploadEventImage(INSPO_BUCKET, event.id, file))
      }

      const { error } = await supabase
        .from('events')
        .update({
          host_display_name: hostDisplayName.trim(),
          name: name.trim(),
          event_date: eventDate,
          location: location.trim(),
          event_type: eventType,
          dress_code_text: dressCode.trim(),
          inspo_image_urls: [...keptInspo, ...uploaded],
          required_colors: parseColorList(requiredColors),
          suggested_colors: parseColorList(suggestedColors),
          off_limit_colors: parseColorList(offLimitColors),
          show_invite_code_to_guests: showInviteCode,
        })
        .eq('id', event.id)

      if (error) {
        setMessage(`Error: ${error.message}`)
        setSaving(false)
        return
      }

      // Clean up images the host removed now that the event is saved.
      await removeEventImages(
        INSPO_BUCKET,
        (event.inspo_image_urls ?? []).filter((url) => !keptInspo.includes(url))
      )

      router.push(`/event/${code}`)
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
      setSaving(false)
    }
  }

  const handleDeleteEvent = async () => {
    if (!event || saving || deleting) return
    if (
      !window.confirm(
        `Delete "${event.name}"? This permanently removes the event, its inspo images, and every outfit guests have posted. This can't be undone.`
      )
    )
      return

    setDeleting(true)
    setMessage('')

    // Order matters: the inspo delete policy checks that the host still
    // owns the event, so those files go first. Outfit photos can only be
    // removed once no post references them, i.e. after the event (and its
    // posts, via cascade) is gone.
    const outfitPaths = await listEventFiles('outfit-posts', event.id)
    const inspoPaths = await listEventFiles(INSPO_BUCKET, event.id)
    if (inspoPaths.length > 0) {
      await supabase.storage.from(INSPO_BUCKET).remove(inspoPaths)
    }

    const { error } = await supabase.from('events').delete().eq('id', event.id)
    if (error) {
      setMessage(`Error: ${error.message}`)
      setDeleting(false)
      return
    }

    if (outfitPaths.length > 0) {
      await supabase.storage.from('outfit-posts').remove(outfitPaths)
    }

    router.push('/dashboard')
  }

  if (loading) {
    return <div className="px-6 py-16 text-center text-stone-muted">Loading...</div>
  }

  const field = (key: keyof FieldErrors) => `${inputBase} ${errors[key] ? inputErr : inputOk}`
  const plain = `${inputBase} ${inputOk}`

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <Link href={`/event/${code}`} className="text-sm text-terracotta hover:underline">
        &larr; Back to Event
      </Link>
      <h1 className="mt-3 font-display text-3xl text-stone">Edit Event</h1>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }}
      >
        <section className="mt-6 space-y-4">
          <h2 className={sectionTitle}>Details</h2>

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
        </section>

        <section className="mt-10 space-y-4">
          <h2 className={sectionTitle}>Inspo Images</h2>

          {keptInspo.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {keptInspo.map((url) => (
                <div key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Event inspiration" className="aspect-square w-full rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setKeptInspo((prev) => prev.filter((u) => u !== url))}
                    aria-label="Remove image"
                    className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-stone/70 text-sm text-cream transition-colors hover:bg-terracotta-dark"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-muted">No inspo images yet.</p>
          )}

          <div>
            <label htmlFor="inspo" className={labelClass}>
              Add more
            </label>
            <input
              id="inspo"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setNewFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-sm text-stone-muted file:mr-3 file:rounded-full file:border-0 file:bg-terracotta-light file:px-4 file:py-2 file:text-sm file:font-medium file:text-terracotta-dark"
            />
            {newFiles.length > 0 && (
              <p className="mt-1 text-xs text-stone-muted">
                {newFiles.length} new image{newFiles.length === 1 ? '' : 's'} will be added when you save.
              </p>
            )}
          </div>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className={sectionTitle}>Colors</h2>

          <div>
            <label htmlFor="required" className={labelClass}>
              Required Colors (comma separated)
            </label>
            <input
              id="required"
              value={requiredColors}
              onChange={(e) => setRequiredColors(e.target.value)}
              placeholder="e.g. navy, gold"
              className={plain}
            />
          </div>

          <div>
            <label htmlFor="suggested" className={labelClass}>
              Suggested Colors (comma separated)
            </label>
            <input
              id="suggested"
              value={suggestedColors}
              onChange={(e) => setSuggestedColors(e.target.value)}
              placeholder="e.g. sage green, cream"
              className={plain}
            />
          </div>

          <div>
            <label htmlFor="offlimit" className={labelClass}>
              Off-Limit Colors (comma separated)
            </label>
            <input
              id="offlimit"
              value={offLimitColors}
              onChange={(e) => setOffLimitColors(e.target.value)}
              placeholder="e.g. dusty rose (bridesmaid color)"
              className={plain}
            />
          </div>
        </section>

        <section className="mt-10">
          <h2 className={sectionTitle}>Sharing</h2>
          <label className="mt-3 flex items-center gap-2 text-sm text-stone">
            <input
              type="checkbox"
              checked={showInviteCode}
              onChange={(e) => setShowInviteCode(e.target.checked)}
              className="h-4 w-4 accent-terracotta"
            />
            Show invite code to guests on the event page
          </label>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving || deleting}
            className="rounded-full bg-terracotta px-6 py-2.5 font-medium text-cream transition-colors hover:bg-terracotta-dark disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link
            href={`/event/${code}`}
            className="text-sm text-stone-muted underline decoration-stone-line underline-offset-4 hover:text-terracotta"
          >
            Cancel
          </Link>
        </div>
        {message && <p className="mt-3 text-sm text-stone-muted">{message}</p>}
      </form>

      <section className="mt-14 rounded-lg border border-terracotta-dark/30 p-4">
        <h2 className={sectionTitle}>Delete Event</h2>
        <p className="mt-1 text-sm text-stone-muted">
          Permanently removes this event, its inspo images, and all posted outfits.
        </p>
        <button
          type="button"
          onClick={handleDeleteEvent}
          disabled={saving || deleting}
          className="mt-3 rounded-full border border-terracotta-dark px-5 py-2 text-sm font-medium text-terracotta-dark transition-colors hover:bg-terracotta-dark hover:text-cream disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete Event'}
        </button>
      </section>
    </div>
  )
}
