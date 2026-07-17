'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { uploadEventImage } from '@/lib/uploadImage'
import { getGuestName, setGuestName, getGuestToken, addMyPostId } from '@/lib/guestIdentity'

type Props = {
  eventId: string
  inviteCode: string
  onPosted: () => void
}

const inputClass =
  'block w-full rounded-md border border-stone-line bg-cream px-3 py-2 text-sm text-stone placeholder:text-stone-muted focus:border-terracotta focus:outline-none'

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

      const { data: postId, error } = await supabase.rpc('insert_outfit_post', {
        p_code: inviteCode,
        p_display_name: name.trim(),
        p_image_url: imageUrl,
        p_caption: caption.trim() || null,
        p_guest_token: getGuestToken(),
      })

      if (error) {
        setMessage(`Error: ${error.message}`)
        setSubmitting(false)
        return
      }

      if (postId) {
        addMyPostId(eventId, postId)
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
    <div className="rounded-lg border border-stone-line bg-cream-dark/40 p-5">
      <h3 className="font-display text-xl text-stone">Post Your Outfit</h3>

      <div className="mt-4 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name"
          className={inputClass}
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-stone-muted file:mr-3 file:rounded-full file:border-0 file:bg-terracotta-light file:px-4 file:py-2 file:text-sm file:font-medium file:text-terracotta-dark"
        />
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption (optional)"
          className={inputClass}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-4 rounded-full bg-terracotta px-5 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-dark disabled:opacity-50"
      >
        {submitting ? 'Posting...' : 'Post Outfit'}
      </button>
      {message && <p className="mt-2 text-sm text-stone-muted">{message}</p>}
    </div>
  )
}
