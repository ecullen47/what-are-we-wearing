'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { removeEventImages, uploadEventImage } from '@/lib/uploadImage'
import { getGuestName, setGuestName, getGuestToken, addMyPostId } from '@/lib/guestIdentity'
import SwatchPicker from '@/components/SwatchPicker'
import ColorWarnings, { offLimitMatches } from '@/components/ColorWarnings'
import PhotoViewer from '@/components/PhotoViewer'
import { toast } from '@/lib/toast'

type Props = {
  eventId: string
  inviteCode: string
  requiredColors: string[]
  offLimitColors: string[]
  // How many existing posts use each color id.
  takenCounts: Map<string, number>
  inspoUrls: string[]
  hostName: string | null
  onPosted: () => void
}

// A chosen photo plus a local URL for previewing it before upload.
type Picked = { file: File; url: string }

const pick = (files: File[]): Picked[] => files.map((file) => ({ file, url: URL.createObjectURL(file) }))
const release = (picked: Picked[]) => picked.forEach((p) => URL.revokeObjectURL(p.url))

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
  inspoUrls,
  hostName,
  onPosted,
}: Props) {
  const [mode, setMode] = useState<'outfit' | 'poll'>('outfit')
  const [name, setName] = useState(() => getGuestName() ?? '')
  const [outfit, setOutfit] = useState<Picked | null>(null)
  const [pollPicks, setPollPicks] = useState<Picked[]>([])
  // Which inspo photo sits beside the guest's photo, and which (if any)
  // is open full size.
  const [compareIndex, setCompareIndex] = useState(0)
  const [viewing, setViewing] = useState<number | null>(null)
  const [caption, setCaption] = useState('')
  const [colors, setColors] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Bumped after posting to reset the (uncontrolled) file input.
  const [fileInputKey, setFileInputKey] = useState(0)

  const clashes = offLimitMatches(colors, offLimitColors)
  const pollFiles = pollPicks.map((p) => p.file)
  const shownInspo = inspoUrls.length > 0 ? compareIndex % inspoUrls.length : 0

  const chooseOutfit = (files: File[]) => {
    if (outfit) release([outfit])
    setOutfit(pick(files.slice(0, 1))[0] ?? null)
  }
  const choosePollOptions = (files: File[]) => {
    release(pollPicks)
    setPollPicks(pick(files))
  }

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

      choosePollOptions([])
      setFileInputKey((k) => k + 1)
      setCaption('')
      setMode('outfit')
      setMessage('')
      toast('Poll posted! Let the voting begin.')
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
    if (!outfit) {
      setMessage('Please choose a photo.')
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      setGuestName(name.trim())

      const imageUrl = await uploadEventImage('outfit-posts', eventId, outfit.file)

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

      chooseOutfit([])
      setFileInputKey((k) => k + 1)
      setCaption('')
      setColors([])
      setMessage('')
      toast('Posted! Looking good.')
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

      {/* Once a guest has picked an outfit photo, the side-by-side below
          takes over from this strip. */}
      {inspoUrls.length > 0 && !(mode === 'outfit' && outfit) && (
        <div className="mt-4">
          <p className="text-xs font-medium tracking-wide text-stone-muted uppercase">
            The inspo{hostName ? ` from ${hostName}` : ''}
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {inspoUrls.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => {
                  setViewing(i)
                  setCompareIndex(i)
                }}
                aria-label={`View inspo photo ${i + 1} full size`}
                className="group shrink-0 overflow-hidden rounded-lg border border-stone-line"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-32 w-24 object-cover transition-transform group-hover:scale-[1.04]"
                />
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-stone-muted">
            Tap to see full size. Pick your photo and it&apos;ll sit right next to these.
          </p>
        </div>
      )}

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
              onChange={(e) => choosePollOptions(Array.from(e.target.files ?? []))}
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
            {pollPicks.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {pollPicks.map((p, i) => (
                  <figure key={p.url}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="aspect-3/4 w-full rounded-lg object-cover" />
                    <figcaption className="mt-1 text-center text-xs text-stone-muted">Option {i + 1}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <input
              key={fileInputKey}
              type="file"
              accept="image/*"
              onChange={(e) => chooseOutfit(Array.from(e.target.files ?? []))}
              className={fileInputClass}
            />
            {outfit && (
              <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={outfit.url}
                    alt="Your outfit"
                    className="aspect-3/4 w-full rounded-lg object-cover shadow-sm"
                  />
                  <figcaption className="mt-1 text-center text-xs font-medium text-stone">Your look</figcaption>
                </figure>
                {inspoUrls.length > 0 && (
                  <figure>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setViewing(shownInspo)}
                        aria-label="View this inspo photo full size"
                        className="block w-full overflow-hidden rounded-lg"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={inspoUrls[shownInspo]}
                          alt="Event inspiration"
                          className="aspect-3/4 w-full object-cover shadow-sm"
                        />
                      </button>
                      {inspoUrls.length > 1 && (
                        <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                          {[
                            { delta: -1, label: 'Previous inspo photo', glyph: '‹' },
                            { delta: 1, label: 'Next inspo photo', glyph: '›' },
                          ].map((b) => (
                            <button
                              key={b.delta}
                              type="button"
                              onClick={() =>
                                setCompareIndex(
                                  (i) => ((i % inspoUrls.length) + b.delta + inspoUrls.length) % inspoUrls.length
                                )
                              }
                              aria-label={b.label}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-cream/90 text-lg leading-none text-stone shadow-sm hover:bg-cream"
                            >
                              {b.glyph}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <figcaption className="mt-1 text-center text-xs text-stone-muted">
                      Inspo{inspoUrls.length > 1 ? ` ${shownInspo + 1} of ${inspoUrls.length}` : ''}
                    </figcaption>
                  </figure>
                )}
              </div>
            )}
          </div>
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

      {viewing !== null && (
        <PhotoViewer
          photos={inspoUrls.map((url) => ({
            key: url,
            url,
            alt: 'Event inspiration',
            caption: <p>Inspo{hostName ? <> from <strong>{hostName}</strong></> : null}</p>,
          }))}
          index={viewing}
          onIndexChange={(i) => {
            // The last inspo looked at is the one shown beside your photo.
            setViewing(i)
            setCompareIndex(i)
          }}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}
