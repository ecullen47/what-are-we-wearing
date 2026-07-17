'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { uploadEventImage } from '@/lib/uploadImage'

type Event = {
  id: string
  host_id: string
  invite_code: string
}

function parseColorList(input: string): string[] {
  return input
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
}

const inputClass =
  'block w-full rounded-md border border-stone-line bg-white px-4 py-2 text-stone placeholder:text-stone-muted focus:border-terracotta focus:outline-none'
const labelClass = 'mb-1 block text-sm font-medium text-stone'

export default function EventSetupPage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [files, setFiles] = useState<FileList | null>(null)
  const [requiredColors, setRequiredColors] = useState('')
  const [suggestedColors, setSuggestedColors] = useState('')
  const [offLimitColors, setOffLimitColors] = useState('')
  const [showInviteCode, setShowInviteCode] = useState(true)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user

      const { data, error } = await supabase
        .from('events')
        .select('id, host_id, invite_code')
        .eq('invite_code', code)
        .single()

      if (error || !data || !user || data.host_id !== user.id) {
        router.push(`/event/${code}`)
        return
      }

      setEvent(data)
      setLoading(false)
    }

    load()
  }, [code, router])

  const handleSkip = () => {
    router.push(`/event/${code}`)
  }

  const handleSubmit = async () => {
    if (!event) return
    setSubmitting(true)
    setMessage('')

    try {
      const inspoUrls: string[] = []
      if (files) {
        for (const file of Array.from(files)) {
          const url = await uploadEventImage('event-inspo', event.id, file)
          inspoUrls.push(url)
        }
      }

      const { error } = await supabase
        .from('events')
        .update({
          inspo_image_urls: inspoUrls,
          required_colors: parseColorList(requiredColors),
          suggested_colors: parseColorList(suggestedColors),
          off_limit_colors: parseColorList(offLimitColors),
          show_invite_code_to_guests: showInviteCode,
        })
        .eq('id', event.id)

      if (error) {
        setMessage(`Error: ${error.message}`)
        setSubmitting(false)
        return
      }

      router.push(`/event/${code}`)
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="px-6 py-16 text-center text-stone-muted">Loading...</div>
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <h1 className="font-display text-3xl text-stone">Add Inspo &amp; Colors</h1>
      <p className="mt-2 text-stone-muted">
        Help your guests know what to wear. You can skip this and add it later.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className={labelClass}>Inspo Images</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(e.target.files)}
            className="block w-full text-sm text-stone-muted file:mr-3 file:rounded-full file:border-0 file:bg-terracotta-light file:px-4 file:py-2 file:text-sm file:font-medium file:text-terracotta-dark"
          />
        </div>

        <div>
          <label className={labelClass}>Required Colors (comma separated)</label>
          <input
            value={requiredColors}
            onChange={(e) => setRequiredColors(e.target.value)}
            placeholder="e.g. navy, gold"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Suggested Colors (comma separated)</label>
          <input
            value={suggestedColors}
            onChange={(e) => setSuggestedColors(e.target.value)}
            placeholder="e.g. sage green, cream"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Off-Limit Colors (comma separated)</label>
          <input
            value={offLimitColors}
            onChange={(e) => setOffLimitColors(e.target.value)}
            placeholder="e.g. dusty rose (bridesmaid color)"
            className={inputClass}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-stone">
          <input
            type="checkbox"
            checked={showInviteCode}
            onChange={(e) => setShowInviteCode(e.target.checked)}
            className="h-4 w-4 accent-terracotta"
          />
          Show invite code to guests on the event page
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-full bg-terracotta px-6 py-2.5 font-medium text-cream transition-colors hover:bg-terracotta-dark disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save & Continue'}
        </button>
        <button
          onClick={handleSkip}
          disabled={submitting}
          className="text-sm text-stone-muted underline decoration-stone-line underline-offset-4 hover:text-terracotta"
        >
          I don&apos;t want to add event info
        </button>
      </div>
      {message && <p className="mt-3 text-sm text-stone-muted">{message}</p>}
    </div>
  )
}
