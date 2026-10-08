'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import OutfitPostForm from '@/components/OutfitPostForm'
import { getGuestToken, getMyPostIds, removeMyPostId } from '@/lib/guestIdentity'
import { removeEventImages, uploadEventImage } from '@/lib/uploadImage'
import { formatEventDate } from '@/lib/formatDate'
import ColorChip, { SwatchDot } from '@/components/ColorChip'
import SwatchPicker from '@/components/SwatchPicker'
import ColorWarnings from '@/components/ColorWarnings'

type EventData = {
  id: string
  name: string
  event_date: string
  location: string
  event_type: string
  dress_code_text: string
  invite_code: string
  host_display_name: string | null
  show_invite_code_to_guests: boolean
  inspo_image_urls: string[]
  required_colors: string[]
  suggested_colors: string[]
  off_limit_colors: string[]
  color_notes: string | null
}

type OutfitPost = {
  id: string
  display_name: string
  image_url: string
  caption: string | null
  colors: string[] | null
  created_at: string
}

// How many posts use each color id, optionally ignoring one post (the one
// being edited, so it doesn't count against itself).
function countColors(posts: OutfitPost[], excludeId?: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const p of posts) {
    if (p.id === excludeId) continue
    for (const c of p.colors ?? []) counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  return counts
}

const inputClass =
  'block w-full rounded-md border border-stone-line bg-white px-3 py-2 text-sm text-stone placeholder:text-stone-muted focus:border-terracotta focus:outline-none'

function ColorSection({ title, colors }: { title: string; colors: string[] }) {
  if (colors.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm text-stone">
      <span className="font-medium">{title}:</span>
      {colors.map((c) => (
        <ColorChip key={c} value={c} />
      ))}
    </div>
  )
}

export default function EventPage() {
  const { code } = useParams<{ code: string }>()

  const [event, setEvent] = useState<EventData | null>(null)
  const [posts, setPosts] = useState<OutfitPost[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [isAttending, setIsAttending] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [myPostIds, setMyPostIds] = useState<string[]>([])
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCaption, setEditCaption] = useState('')
  const [editFile, setEditFile] = useState<File | null>(null)
  const [editColors, setEditColors] = useState<string[]>([])
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editMessage, setEditMessage] = useState('')
  const [copied, setCopied] = useState(false)

  const loadPosts = useCallback(async () => {
    const { data } = await supabase.rpc('get_outfit_posts_by_code', { p_code: code })
    setPosts(data ?? [])
  }, [code])

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .rpc('get_event_by_code', { p_code: code })
        .single()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const eventData = data as EventData
      setEvent(eventData)
      setMyPostIds(getMyPostIds(eventData.id))
      await loadPosts()

      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user) {
        setUserId(userData.user.id)
        const { data: ownEvent } = await supabase
          .from('events')
          .select('id')
          .eq('id', eventData.id)
          .eq('host_id', userData.user.id)
          .maybeSingle()
        setIsHost(!!ownEvent)

        const { data: attendance } = await supabase
          .from('event_attendance')
          .select('id')
          .eq('event_id', eventData.id)
          .eq('user_id', userData.user.id)
          .maybeSingle()
        setIsAttending(!!attendance)
      }

      setLoading(false)
    }

    load()
  }, [code, loadPosts])

  const handleDelete = async (post: OutfitPost) => {
    if (!event) return
    if (!window.confirm('Delete this outfit post?')) return

    const { error } = isHost
      ? await supabase.from('outfit_posts').delete().eq('id', post.id)
      : await supabase.rpc('delete_own_outfit_post', {
          p_code: code,
          p_post_id: post.id,
          p_guest_token: getGuestToken(),
        })

    if (!error) {
      if (!isHost) {
        removeMyPostId(event.id, post.id)
        setMyPostIds(getMyPostIds(event.id))
      }
      // The post is gone, so its photo is now unreferenced and deletable.
      await removeEventImages('outfit-posts', [post.image_url])
    }

    await loadPosts()
  }

  const handleAddToMyEvents = async () => {
    if (!event || !userId) return
    setJoining(true)
    const { error } = await supabase
      .from('event_attendance')
      .upsert({ event_id: event.id, user_id: userId }, { onConflict: 'event_id,user_id', ignoreDuplicates: true })
    if (!error) setIsAttending(true)
    setJoining(false)
  }

  const handleStartEdit = (post: OutfitPost) => {
    setEditingPostId(post.id)
    setEditName(post.display_name)
    setEditCaption(post.caption ?? '')
    setEditColors(post.colors ?? [])
    setEditFile(null)
    setEditMessage('')
  }

  const handleCancelEdit = () => {
    setEditingPostId(null)
    setEditFile(null)
    setEditMessage('')
  }

  const handleSaveEdit = async (post: OutfitPost) => {
    if (!event) return
    if (!editName.trim()) {
      setEditMessage('Please enter a name.')
      return
    }

    setEditSubmitting(true)
    setEditMessage('')

    try {
      const imageUrl = editFile ? await uploadEventImage('outfit-posts', event.id, editFile) : post.image_url

      const { error } = await supabase.rpc('update_own_outfit_post', {
        p_code: code,
        p_post_id: post.id,
        p_guest_token: getGuestToken(),
        p_display_name: editName.trim(),
        p_image_url: imageUrl,
        p_caption: editCaption.trim() || null,
        p_colors: editColors,
      })

      if (error) {
        setEditMessage(`Error: ${error.message}`)
        setEditSubmitting(false)
        return
      }

      // Replaced photo is no longer referenced by the post, so clean it up.
      if (editFile && imageUrl !== post.image_url) {
        await removeEventImages('outfit-posts', [post.image_url])
      }

      setEditingPostId(null)
      await loadPosts()
    } catch (err) {
      setEditMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setEditSubmitting(false)
    }
  }

  useEffect(() => {
    if (event) {
      document.title = `${event.name} — What Are We Wearing`
    }
  }, [event])

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const colorCounts = countColors(posts)

  if (loading) {
    return <div className="px-6 py-16 text-center text-stone-muted">Loading...</div>
  }

  if (notFound || !event) {
    return (
      <div className="px-6 py-16 text-center">
        <h1 className="font-display text-3xl text-stone">Event not found</h1>
        <p className="mt-2 text-stone-muted">
          Double-check the invite link or code. The event may also have been deleted by its host.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-terracotta px-6 py-2.5 font-medium text-cream transition-colors hover:bg-terracotta-dark"
        >
          Go to homepage
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {(isHost || isAttending) && (
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" className="text-sm text-terracotta hover:underline">
            &larr; Back to Dashboard
          </Link>
          {isHost && (
            <Link
              href={`/event/${code}/edit`}
              className="shrink-0 rounded-full border border-terracotta px-4 py-1.5 text-sm font-medium text-terracotta transition-colors hover:bg-terracotta-light"
            >
              Edit Event
            </Link>
          )}
        </div>
      )}
      {userId && !isHost && !isAttending && (
        <button
          onClick={handleAddToMyEvents}
          disabled={joining}
          className="rounded-full border border-terracotta px-4 py-1.5 text-sm font-medium text-terracotta transition-colors hover:bg-terracotta-light disabled:opacity-50"
        >
          {joining ? 'Adding...' : '+ Add to my events'}
        </button>
      )}
      {event.host_display_name && (
        <p className="mt-2 text-sm text-stone-muted">Hosted by {event.host_display_name}</p>
      )}
      <h1 className="mt-1 font-display text-4xl text-stone">{event.name}</h1>

      {event.show_invite_code_to_guests && (
        <p className="mt-2 text-sm text-stone-muted">
          Invite code: <strong className="text-stone">{event.invite_code}</strong>{' '}
          <button
            onClick={handleCopyLink}
            className="ml-1 rounded-full border border-terracotta px-3 py-1 text-xs font-medium text-terracotta transition-colors hover:bg-terracotta-light"
          >
            {copied ? 'Copied!' : 'Copy link to share'}
          </button>
        </p>
      )}

      {event.inspo_image_urls.length > 0 && (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
          {event.inspo_image_urls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt="Event inspiration"
              className="aspect-square w-full rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      {(event.required_colors.length > 0 ||
        event.suggested_colors.length > 0 ||
        event.off_limit_colors.length > 0 ||
        event.color_notes) && (
        <div className="mt-6 space-y-2 rounded-lg border border-stone-line bg-cream-dark/40 p-4">
          <ColorSection title="Required" colors={event.required_colors} />
          <ColorSection title="Suggested" colors={event.suggested_colors} />
          <ColorSection title="Off-limit" colors={event.off_limit_colors} />
          {event.color_notes && <p className="text-sm text-stone-muted">{event.color_notes}</p>}
        </div>
      )}

      <p className="mt-6 text-stone">
        {formatEventDate(event.event_date)} &middot; {event.location}
      </p>
      {event.dress_code_text && <p className="mt-1 text-stone-muted">Dress code: {event.dress_code_text}</p>}

      <div className="mt-8">
        <OutfitPostForm
          eventId={event.id}
          inviteCode={event.invite_code}
          requiredColors={event.required_colors}
          offLimitColors={event.off_limit_colors}
          takenCounts={colorCounts}
          onPosted={() => {
            // The form just recorded the new post as ours; re-read so its
            // Edit/Delete buttons show without a reload.
            setMyPostIds(getMyPostIds(event.id))
            loadPosts()
          }}
        />
      </div>

      <h2 className="mt-10 font-display text-2xl text-stone">Outfits</h2>
      {colorCounts.size > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium tracking-wide text-stone-muted uppercase">Colors so far</p>
          <div className="flex flex-wrap gap-1.5">
            {[...colorCounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([id, n]) => (
                <ColorChip key={id} value={id} count={n} />
              ))}
          </div>
        </div>
      )}
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
        {posts.map((post) =>
          editingPostId === post.id ? (
            <div key={post.id} className="col-span-full rounded-lg border border-terracotta bg-white p-3">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={`${inputClass} mb-2`}
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                className="mb-2 block w-full text-xs text-stone-muted file:mr-2 file:rounded-full file:border-0 file:bg-terracotta-light file:px-3 file:py-1 file:text-xs file:font-medium file:text-terracotta-dark"
              />
              <input
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder="Caption (optional)"
                className={`${inputClass} mb-2`}
              />
              <div className="mb-3">
                <SwatchPicker value={editColors} onChange={setEditColors} />
                <ColorWarnings
                  selected={editColors}
                  required={event.required_colors}
                  offLimit={event.off_limit_colors}
                  takenCounts={countColors(posts, post.id)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveEdit(post)}
                  disabled={editSubmitting}
                  className="rounded-full bg-terracotta px-3 py-1 text-xs font-medium text-cream hover:bg-terracotta-dark disabled:opacity-50"
                >
                  {editSubmitting ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={editSubmitting}
                  className="rounded-full border border-stone-line px-3 py-1 text-xs font-medium text-stone-muted hover:border-terracotta hover:text-terracotta"
                >
                  Cancel
                </button>
              </div>
              {editMessage && <p className="mt-2 text-xs text-stone-muted">{editMessage}</p>}
            </div>
          ) : (
            <div key={post.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.image_url}
                alt={`${post.display_name}'s outfit`}
                className="aspect-square w-full rounded-lg object-cover"
              />
              <p className="mt-1.5 text-sm text-stone">
                <strong>{post.display_name}</strong>
                {post.caption ? <span className="text-stone-muted"> — {post.caption}</span> : ''}
              </p>
              {(post.colors ?? []).length > 0 && (
                <div className="mt-1 flex gap-1">
                  {(post.colors ?? []).map((c) => (
                    <SwatchDot key={c} value={c} />
                  ))}
                </div>
              )}
              <div className="mt-1 flex gap-3">
                {myPostIds.includes(post.id) && (
                  <button
                    onClick={() => handleStartEdit(post)}
                    className="text-xs text-terracotta hover:underline"
                  >
                    Edit
                  </button>
                )}
                {(isHost || myPostIds.includes(post.id)) && (
                  <button
                    onClick={() => handleDelete(post)}
                    className="text-xs text-stone-muted hover:text-terracotta hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
