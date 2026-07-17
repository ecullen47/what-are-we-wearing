'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import OutfitPostForm from '@/components/OutfitPostForm'
import { getGuestToken, getMyPostIds, removeMyPostId } from '@/lib/guestIdentity'
import { uploadEventImage } from '@/lib/uploadImage'

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
}

type OutfitPost = {
  id: string
  display_name: string
  image_url: string
  caption: string | null
  created_at: string
}

const inputClass =
  'block w-full rounded-md border border-stone-line bg-white px-3 py-2 text-sm text-stone placeholder:text-stone-muted focus:border-terracotta focus:outline-none'

function ColorSection({ title, colors }: { title: string; colors: string[] }) {
  if (colors.length === 0) return null
  return (
    <p className="text-sm text-stone">
      <span className="font-medium">{title}:</span> <span className="text-stone-muted">{colors.join(', ')}</span>
    </p>
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
  const [myPostIds, setMyPostIds] = useState<string[]>([])
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCaption, setEditCaption] = useState('')
  const [editFile, setEditFile] = useState<File | null>(null)
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

  const handleDelete = async (postId: string) => {
    if (!event) return
    if (!window.confirm('Delete this outfit post?')) return

    if (isHost) {
      await supabase.from('outfit_posts').delete().eq('id', postId)
    } else {
      await supabase.rpc('delete_own_outfit_post', {
        p_code: code,
        p_post_id: postId,
        p_guest_token: getGuestToken(),
      })
      removeMyPostId(event.id, postId)
      setMyPostIds(getMyPostIds(event.id))
    }

    await loadPosts()
  }

  const handleStartEdit = (post: OutfitPost) => {
    setEditingPostId(post.id)
    setEditName(post.display_name)
    setEditCaption(post.caption ?? '')
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
      })

      if (error) {
        setEditMessage(`Error: ${error.message}`)
        setEditSubmitting(false)
        return
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

  if (loading) {
    return <div className="px-6 py-16 text-center text-stone-muted">Loading...</div>
  }

  if (notFound || !event) {
    return <div className="px-6 py-16 text-center text-stone-muted">Event not found.</div>
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {(isHost || isAttending) && (
        <Link href="/dashboard" className="text-sm text-terracotta hover:underline">
          &larr; Back to Dashboard
        </Link>
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
        event.off_limit_colors.length > 0) && (
        <div className="mt-6 space-y-1 rounded-lg border border-stone-line bg-cream-dark/40 p-4">
          <ColorSection title="Required Colors" colors={event.required_colors} />
          <ColorSection title="Suggested Colors" colors={event.suggested_colors} />
          <ColorSection title="Off-Limit Colors" colors={event.off_limit_colors} />
        </div>
      )}

      <p className="mt-6 text-stone">
        {event.event_date} &middot; {event.location}
      </p>
      {event.dress_code_text && <p className="mt-1 text-stone-muted">Dress code: {event.dress_code_text}</p>}

      <div className="mt-8">
        <OutfitPostForm eventId={event.id} inviteCode={event.invite_code} onPosted={loadPosts} />
      </div>

      <h2 className="mt-10 font-display text-2xl text-stone">Outfits</h2>
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
        {posts.map((post) =>
          editingPostId === post.id ? (
            <div key={post.id} className="rounded-lg border border-terracotta bg-white p-3">
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
                    onClick={() => handleDelete(post.id)}
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
