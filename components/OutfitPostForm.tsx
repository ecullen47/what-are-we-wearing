'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { removeEventImages, uploadEventImage } from '@/lib/uploadImage'
import { getGuestName, setGuestName, getGuestToken, addMyPostId } from '@/lib/guestIdentity'
import SwatchPicker from '@/components/SwatchPicker'
import ColorWarnings, { offLimitMatches } from '@/components/ColorWarnings'

type Props = {
  eventId: string
  inviteCode: string
  requiredColors: string[]
  offLimitColors: string[]
  // How many existing posts use each color id.
  takenCounts: Map<string, number>
  onPosted: () => void
}

const inputClass =
  'block w-full rounded-md border border-stone-line bg-cream px-3 py-2 text-sm text-stone placeholder:text-stone-muted focus:border-terracotta focus:outline-none'
const fileInputClass =
  'block w-full text-sm text-stone-muted file:mr-3 file:rounded-full file:border-0 file:bg-terracotta-light file:px-4 file:py-2 file:text-sm file:font-medium file:text-terracotta-dark'

// Matches the limits enforced by the create_outfit_poll database function.
const MIN_POLL_OPTIONS = 2
const MAX_POLL_OPTIONS = 3

export default function OutfitPostForm({
  eventId,
  inviteCode,
  requiredColors,
  offLimitColors,
  takenCounts,
  onPosted,
}: Props) {
  const [mode, setMode] = useState<'outfit' | 'poll'>('outfit')
  const [name, setName] = useState(() => getGuestName() ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [pollFiles, setPollFiles] = useState<File[]>([])
  const [caption, setCaption] = useState('')
  const [colors, setColors] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Bumped after posting to reset the (uncontrolled) file input.
  const [fileInputKey, setFileInputKey] = useState(0)

  const clashes = offLimitMatches(colors, offLimitColors)

  const handleSubmitPoll = async () => {
    if (!name.trim()) {
      setMessage('Please enter your name.')
      return
    }
    if (pollFiles.length < MIN_POLL_OPTIONS || pollFiles.length > MAX_POLL_OPTIONS) {
      setMessage(`Choose ${MIN_POLL_OPTIONS} or ${MAX_POLL_OPTIONS} outfit photos for people to vote on.`)
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      setGuestName(name.trim())

      const imageUrls: string[] = []
      for (const f of pollFiles) {
        imageUrls.push(await uploadEventImage('outfit-posts', eventId, f))
      }

      const { data: postId, error } = await supabase.rpc('create_outfit_poll', {
        p_code: inviteCode,
        p_display_name: name.trim(),
        p_guest_token: getGuestToken(),
        p_image_urls: imageUrls,
        p_caption: caption.trim() || null,
      })

      if (error) {
        // The poll wasn't created, so the uploaded photos are orphans.
        await removeEventImages('outfit-posts', imageUrls)
        setMessage(`Error: ${error.message}`)
        return
      }

      if (postId) addMyPostId(eventId, postId)

      setPollFiles([])
      setFileInputKey((k) => k + 1)
      setCaption('')
      setMode('outfit')
      setMessage('Poll posted! Guests can vote now.')
      onPosted()
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    if (mode === 'poll') return handleSubmitPoll()
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
        p_colors: colors,
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
      setFileInputKey((k) => k + 1)
      setCaption('')
      setColors([])
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
      <h3 className="font-display text-xl text-stone">
        {mode === 'poll' ? 'Help Me Choose' : 'Post Your Outfit'}
      </h3>
      <button
        type="button"
        onClick={() => {
          setMode(mode === 'poll' ? 'outfit' : 'poll')
          setMessage('')
        }}
        className="mt-1 text-sm text-terracotta underline decoration-terracotta/40 underline-offset-4 hover:decoration-terracotta"
      >
        {mode === 'poll' ? '← Back to posting one outfit' : "Can't decide? Post 2–3 options and let guests vote"}
      </button>

      <div className="mt-4 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name"
          className={inputClass}
        />
        {mode === 'poll' ? (
          <div>
            <input
              key={`poll-${fileInputKey}`}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setPollFiles(Array.from(e.target.files ?? []))}
              className={fileInputClass}
            />
            <p className="mt-1 text-xs text-stone-muted">
              {pollFiles.length === 0
                ? `Choose ${MIN_POLL_OPTIONS} or ${MAX_POLL_OPTIONS} outfit photos.`
                : `${pollFiles.length} photo${pollFiles.length === 1 ? '' : 's'} chosen${
                    pollFiles.length < MIN_POLL_OPTIONS || pollFiles.length > MAX_POLL_OPTIONS
                      ? ` — pick ${MIN_POLL_OPTIONS} or ${MAX_POLL_OPTIONS}`
                      : ''
                  }.`}
            </p>
          </div>
        ) : (
          <input
            key={fileInputKey}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={fileInputClass}
          />
        )}
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={mode === 'poll' ? 'Question (optional), e.g. "Which for the ceremony?"' : 'Caption (optional)'}
          className={inputClass}
        />
        {mode === 'outfit' && (
          <div>
            <p className="mb-2 text-sm font-medium text-stone">
              Outfit colors <span className="font-normal text-stone-muted">(optional)</span>
            </p>
            <SwatchPicker value={colors} onChange={setColors} />
            <ColorWarnings
              selected={colors}
              required={requiredColors}
              offLimit={offLimitColors}
              takenCounts={takenCounts}
            />
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-4 rounded-full bg-terracotta px-5 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-dark disabled:opacity-50"
      >
        {submitting
          ? 'Posting...'
          : mode === 'poll'
            ? 'Post Poll'
            : clashes.length > 0
              ? 'Post Anyway'
              : 'Post Outfit'}
      </button>
      {message && <p className="mt-2 text-sm text-stone-muted">{message}</p>}
    </div>
  )
}
