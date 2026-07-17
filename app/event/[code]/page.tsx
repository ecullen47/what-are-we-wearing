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

function ColorSection({ title, colors }: { title: string; colors: string[] }) {
  if (colors.length === 0) return null
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <strong>{title}:</strong> {colors.join(', ')}
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
  const [myPostIds, setMyPostIds] = useState<string[]>([])
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCaption, setEditCaption] = useState('')
  const [editFile, setEditFile] = useState<File | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editMessage, setEditMessage] = useState('')

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

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>
  }

  if (notFound || !event) {
    return <div style={{ padding: '2rem' }}>Event not found.</div>
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      {(isHost || isAttending) && <Link href="/dashboard">&larr; Back to Dashboard</Link>}
      <h1>{event.name}</h1>

      {event.inspo_image_urls.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '0.5rem',
            marginBottom: '1.5rem',
          }}
        >
          {event.inspo_image_urls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt="Event inspiration"
              style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '0.5rem' }}
            />
          ))}
        </div>
      )}

      {(event.required_colors.length > 0 ||
        event.suggested_colors.length > 0 ||
        event.off_limit_colors.length > 0) && (
        <div style={{ marginBottom: '1.5rem' }}>
          <ColorSection title="Required Colors" colors={event.required_colors} />
          <ColorSection title="Suggested Colors" colors={event.suggested_colors} />
          <ColorSection title="Off-Limit Colors" colors={event.off_limit_colors} />
        </div>
      )}

      <p>
        {event.event_date} &middot; {event.location}
      </p>
      {event.dress_code_text && <p>Dress code: {event.dress_code_text}</p>}

      <div style={{ margin: '1.5rem 0' }}>
        <OutfitPostForm eventId={event.id} inviteCode={event.invite_code} onPosted={loadPosts} />
      </div>

      <h2>Outfits</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '0.5rem',
        }}
      >
        {posts.map((post) =>
          editingPostId === post.id ? (
            <div key={post.id} style={{ border: '1px solid #ddd', borderRadius: '0.5rem', padding: '0.5rem' }}>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ display: 'block', marginBottom: '0.5rem', width: '100%', padding: '0.25rem' }}
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                style={{ display: 'block', marginBottom: '0.5rem', width: '100%' }}
              />
              <input
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder="Caption (optional)"
                style={{ display: 'block', marginBottom: '0.5rem', width: '100%', padding: '0.25rem' }}
              />
              <button onClick={() => handleSaveEdit(post)} disabled={editSubmitting} style={{ fontSize: '0.75rem', marginRight: '0.5rem' }}>
                {editSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button onClick={handleCancelEdit} disabled={editSubmitting} style={{ fontSize: '0.75rem' }}>
                Cancel
              </button>
              {editMessage && <p style={{ fontSize: '0.75rem' }}>{editMessage}</p>}
            </div>
          ) : (
            <div key={post.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.image_url}
                alt={`${post.display_name}'s outfit`}
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '0.5rem' }}
              />
              <p style={{ fontSize: '0.875rem', margin: '0.25rem 0' }}>
                <strong>{post.display_name}</strong>
                {post.caption ? ` — ${post.caption}` : ''}
              </p>
              {myPostIds.includes(post.id) && (
                <button onClick={() => handleStartEdit(post)} style={{ fontSize: '0.75rem', marginRight: '0.5rem' }}>
                  Edit
                </button>
              )}
              {(isHost || myPostIds.includes(post.id)) && (
                <button onClick={() => handleDelete(post.id)} style={{ fontSize: '0.75rem' }}>
                  Delete
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}
