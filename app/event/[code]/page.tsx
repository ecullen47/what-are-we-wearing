'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import OutfitPostForm from '@/components/OutfitPostForm'

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

      setEvent(data as EventData)
      await loadPosts()
      setLoading(false)
    }

    load()
  }, [code, loadPosts])

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>
  }

  if (notFound || !event) {
    return <div style={{ padding: '2rem' }}>Event not found.</div>
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
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

      <h1>{event.name}</h1>
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
        {posts.map((post) => (
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
          </div>
        ))}
      </div>
    </div>
  )
}
