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
    return <div style={{ padding: '2rem' }}>Loading...</div>
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '500px' }}>
      <h1>Add Inspo &amp; Colors</h1>
      <p>Help your guests know what to wear. You can skip this and add it later.</p>

      <label>Inspo Images</label>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => setFiles(e.target.files)}
        style={{ display: 'block', marginBottom: '1rem', width: '100%' }}
      />

      <label>Required Colors (comma separated)</label>
      <input
        value={requiredColors}
        onChange={(e) => setRequiredColors(e.target.value)}
        placeholder="e.g. navy, gold"
        style={{ display: 'block', marginBottom: '1rem', width: '100%', padding: '0.5rem' }}
      />

      <label>Suggested Colors (comma separated)</label>
      <input
        value={suggestedColors}
        onChange={(e) => setSuggestedColors(e.target.value)}
        placeholder="e.g. sage green, cream"
        style={{ display: 'block', marginBottom: '1rem', width: '100%', padding: '0.5rem' }}
      />

      <label>Off-Limit Colors (comma separated)</label>
      <input
        value={offLimitColors}
        onChange={(e) => setOffLimitColors(e.target.value)}
        placeholder="e.g. dusty rose (bridesmaid color)"
        style={{ display: 'block', marginBottom: '1rem', width: '100%', padding: '0.5rem' }}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="checkbox"
          checked={showInviteCode}
          onChange={(e) => setShowInviteCode(e.target.checked)}
        />
        Show invite code to guests on the event page
      </label>

      <button onClick={handleSubmit} disabled={submitting} style={{ marginRight: '1rem' }}>
        {submitting ? 'Saving...' : 'Save & Continue'}
      </button>
      <button onClick={handleSkip} disabled={submitting}>
        I don&apos;t want to add event info
      </button>
      <p>{message}</p>
    </div>
  )
}
