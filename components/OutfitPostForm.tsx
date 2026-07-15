'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { uploadEventImage } from '@/lib/uploadImage'
import { getGuestName, setGuestName } from '@/lib/guestIdentity'

type Props = {
  eventId: string
  inviteCode: string
  onPosted: () => void
}

export default function OutfitPostForm({ eventId, inviteCode, onPosted }: Props) {
  const [name, setName] = useState(() => getGuestName() ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) {
      setMessage('Please enter your name.')
      return
    }
    if (!file) {
      setMessage('Please choose a photo.')
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      setGuestName(name.trim())

      const imageUrl = await uploadEventImage('outfit-posts', eventId, file)

      const { error } = await supabase.rpc('insert_outfit_post', {
        p_code: inviteCode,
        p_display_name: name.trim(),
        p_image_url: imageUrl,
        p_caption: caption.trim() || null,
      })

      if (error) {
        setMessage(`Error: ${error.message}`)
        setSubmitting(false)
        return
      }

      setFile(null)
      setCaption('')
      setMessage('Posted!')
      onPosted()
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '0.5rem' }}>
      <h3>Post Your Outfit</h3>

      <label>Your Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ display: 'block', marginBottom: '1rem', width: '100%', padding: '0.5rem' }}
      />

      <label>Photo</label>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        style={{ display: 'block', marginBottom: '1rem', width: '100%' }}
      />

      <label>Caption (optional)</label>
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        style={{ display: 'block', marginBottom: '1rem', width: '100%', padding: '0.5rem' }}
      />

      <button onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Posting...' : 'Post Outfit'}
      </button>
      <p>{message}</p>
    </div>
  )
}
