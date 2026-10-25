'use client'

import { useState } from 'react'
import { formatTimeAgo } from '@/lib/formatDate'

// Matches the length check on events.host_note.
const MAX_NOTE_LENGTH = 500

// A note the host pins to the top of the event ("Ceremony moved outdoors,
// bring flats"). Guests see it; the host can write, change or remove it.
export default function HostNote({
  note,
  updatedAt,
  hostName,
  isHost,
  onSave,
}: {
  note: string | null
  updatedAt: string | null
  hostName: string | null
  isHost: boolean
  // Resolves with an error message, or null once saved.
  onSave: (note: string | null) => Promise<string | null>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const save = async (value: string | null) => {
    setSaving(true)
    setMessage('')
    const error = await onSave(value)
    setSaving(false)
    if (error) setMessage(error)
    else setEditing(false)
  }

  if (editing) {
    return (
      <div className="mt-5 rounded-xl border border-terracotta bg-white p-4">
        <label htmlFor="host-note" className="text-sm font-medium text-stone">
          Update for your guests
        </label>
        <textarea
          id="host-note"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          rows={3}
          placeholder="e.g. Ceremony moved outdoors, bring flats!"
          className="mt-2 block w-full rounded-md border border-stone-line bg-cream px-3 py-2 text-sm text-stone placeholder:text-stone-muted focus:border-terracotta focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => save(draft.trim() || null)}
            disabled={saving}
            className="rounded-full bg-terracotta px-4 py-1.5 text-sm font-medium text-cream hover:bg-terracotta-dark disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Pin update'}
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="rounded-full px-3 py-1.5 text-sm text-stone-muted hover:text-stone"
          >
            Cancel
          </button>
          <span className="ml-auto text-xs text-stone-muted">
            {draft.length}/{MAX_NOTE_LENGTH}
          </span>
        </div>
        {message && <p className="mt-2 text-xs text-terracotta-dark">{message}</p>}
      </div>
    )
  }

  if (!note) {
    if (!isHost) return null
    return (
      <button
        onClick={() => {
          setDraft('')
          setEditing(true)
        }}
        className="mt-4 text-sm text-terracotta hover:underline"
      >
        + Pin an update for your guests
      </button>
    )
  }

  return (
    <div className="mt-5 rounded-xl border border-butter-deep/30 bg-butter px-5 py-4" role="status">
      <p className="text-[11px] font-medium tracking-[0.18em] text-butter-deep uppercase">
        Update from {hostName || 'the host'}
        {updatedAt && <span className="tracking-normal normal-case"> · {formatTimeAgo(updatedAt)}</span>}
      </p>
      <p className="mt-1 whitespace-pre-line text-stone">{note}</p>
      {isHost && (
        <div className="mt-2 flex gap-3 text-sm">
          <button
            onClick={() => {
              setDraft(note)
              setEditing(true)
            }}
            className="text-terracotta hover:underline"
          >
            Edit
          </button>
          <button
            onClick={() => save(null)}
            disabled={saving}
            className="text-stone-muted hover:text-terracotta disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
