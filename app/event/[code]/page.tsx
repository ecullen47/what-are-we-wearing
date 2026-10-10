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
import PollCard, { type PollOption } from '@/components/PollCard'
import EventGallery from '@/components/EventGallery'
import PhotoViewer from '@/components/PhotoViewer'
import EventBadges from '@/components/EventBadges'
import { EventPageSkeleton } from '@/components/Skeleton'
import { toast } from '@/lib/toast'

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
  is_poll: boolean
  like_count: number
  liked_by_me: boolean
  // Poll fields; options is null for normal outfit posts.
  options: PollOption[] | null
  my_vote: string | null
  total_votes: number | null
}

// Every stored photo a post uses (a poll has one per option).
function postImageUrls(post: OutfitPost): string[] {
  return [...new Set([post.image_url, ...(post.options ?? []).map((o) => o.image_url)])]
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
  // The outfit feed (post, vote, like, edit) or the photo gallery.
  const [view, setView] = useState<'feed' | 'gallery'>('feed')
  const [inspoOpen, setInspoOpen] = useState<number | null>(null)
  // Post currently being voted on / liked / resolved, to disable its buttons.
  const [busyPostId, setBusyPostId] = useState<string | null>(null)

  // The viewer token lets the server mark our own votes/likes and decide
  // whether we've earned the right to see poll results.
  const loadPosts = useCallback(async () => {
    const { data } = await supabase.rpc('get_outfit_posts_by_code', {
      p_code: code,
      p_viewer_token: getGuestToken(),
    })
    setPosts(data ?? [])
  }, [code])

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .rpc('get_event_by_code', { p_code: code })
        .maybeSingle()

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
      // The post is gone, so its photos are now unreferenced and deletable.
      await removeEventImages('outfit-posts', postImageUrls(post))
      toast('Post deleted')
    }

    await loadPosts()
  }

  const handleVote = async (post: OutfitPost, optionId: string) => {
    setBusyPostId(post.id)
    const { error } = await supabase.rpc('vote_on_poll', {
      p_code: code,
      p_option_id: optionId,
      p_voter_token: getGuestToken(),
    })
    if (!error) toast(post.my_vote ? 'Vote switched' : 'Vote counted!')
    await loadPosts()
    setBusyPostId(null)
  }

  const handlePickWinner = async (post: OutfitPost, optionId: string) => {
    const n = (post.options ?? []).findIndex((o) => o.id === optionId) + 1
    if (!window.confirm(`Wear option ${n}? This closes the poll and keeps only that photo.`)) return
    setBusyPostId(post.id)
    const { data: otherPhotos, error } = await supabase.rpc('pick_poll_winner', {
      p_code: code,
      p_post_id: post.id,
      p_option_id: optionId,
      p_guest_token: getGuestToken(),
    })
    if (!error) {
      // The other options are no longer referenced, so clean them up.
      await removeEventImages('outfit-posts', (otherPhotos as string[] | null) ?? [])
      toast('Decision made! It’s now your outfit post.')
    }
    await loadPosts()
    setBusyPostId(null)
  }

  const handleToggleLike = async (post: OutfitPost) => {
    // Flip it immediately so the heart responds on tap; the reload below
    // replaces this with the real count.
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, liked_by_me: !p.liked_by_me, like_count: p.like_count + (p.liked_by_me ? -1 : 1) }
          : p
      )
    )
    setBusyPostId(post.id)
    await supabase.rpc('toggle_outfit_like', { p_code: code, p_post_id: post.id, p_token: getGuestToken() })
    await loadPosts()
    setBusyPostId(null)
  }

  const handleAddToMyEvents = async () => {
    if (!event || !userId) return
    setJoining(true)
    const { error } = await supabase
      .from('event_attendance')
      .upsert({ event_id: event.id, user_id: userId }, { onConflict: 'event_id,user_id', ignoreDuplicates: true })
    if (!error) {
      setIsAttending(true)
      toast('Added to your events')
    }
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
      toast('Changes saved')
      await loadPosts()
    } catch (err) {
      setEditMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    toast('Link copied. Send it to your guests!')
    setTimeout(() => setCopied(false), 2000)
  }

  const colorCounts = countColors(posts)
  // Inspo images + one photo per outfit + each open poll option.
  const photoCount =
    (event?.inspo_image_urls.length ?? 0) +
    posts.reduce((n, p) => n + (p.is_poll ? (p.options ?? []).length : 1), 0)

  if (loading) {
    return <EventPageSkeleton />
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
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <EventBadges type={event.event_type} date={event.event_date} />
          {isHost ? (
            <Link
              href={`/event/${code}/edit`}
              className="shrink-0 rounded-full border border-terracotta px-4 py-1.5 text-sm font-medium text-terracotta transition-colors hover:bg-terracotta-light"
            >
              Edit Event
            </Link>
          ) : isAttending ? (
            <span className="text-xs font-medium text-stone-muted">&#10003; In your events</span>
          ) : userId ? (
            <button
              onClick={handleAddToMyEvents}
              disabled={joining}
              className="shrink-0 rounded-full border border-terracotta px-4 py-1.5 text-sm font-medium text-terracotta transition-colors hover:bg-terracotta-light disabled:opacity-50"
            >
              {joining ? 'Adding...' : '+ Add to my events'}
            </button>
          ) : null}
        </div>

        <h1 className="mt-4 font-display text-4xl leading-tight text-stone sm:text-5xl">
          {event.name?.trim() || 'Untitled event'}
        </h1>
        {event.host_display_name && (
          <p className="mt-2 text-sm text-stone-muted">
            Hosted by <span className="text-stone">{event.host_display_name}</span>
          </p>
        )}
        <p className="mt-1 text-stone">
          {formatEventDate(event.event_date)}
          {event.location ? <> &middot; {event.location}</> : null}
        </p>

        {event.dress_code_text && (
          <div className="mt-5 rounded-xl border border-blush-deep/20 bg-linear-to-br from-blush to-butter/70 px-5 py-4">
            <p className="text-[11px] font-medium tracking-[0.18em] text-blush-deep uppercase">Dress code</p>
            <p className="mt-1 font-display text-2xl text-stone">{event.dress_code_text}</p>
          </div>
        )}

        {event.show_invite_code_to_guests && (
          <p className="mt-4 text-sm text-stone-muted">
            Invite code: <strong className="tracking-wide text-stone">{event.invite_code}</strong>{' '}
            <button
              onClick={handleCopyLink}
              className="ml-1 rounded-full border border-terracotta px-3 py-1 text-xs font-medium text-terracotta transition-colors hover:bg-terracotta-light"
            >
              {copied ? 'Copied!' : 'Copy link to share'}
            </button>
          </p>
        )}
      </header>

      {event.inspo_image_urls.length > 0 && (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
          {event.inspo_image_urls.map((url, i) => (
            <button
              key={url}
              onClick={() => setInspoOpen(i)}
              aria-label={`View inspo photo ${i + 1} full size`}
              className="group overflow-hidden rounded-lg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Event inspiration"
                className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.03]"
              />
            </button>
          ))}
        </div>
      )}
      {inspoOpen !== null && (
        <PhotoViewer
          photos={event.inspo_image_urls.map((url) => ({
            key: url,
            url,
            alt: 'Event inspiration',
            caption: (
              <p>Inspo{event.host_display_name ? <> from <strong>{event.host_display_name}</strong></> : null}</p>
            ),
          }))}
          index={inspoOpen}
          onIndexChange={setInspoOpen}
          onClose={() => setInspoOpen(null)}
        />
      )}

      {(event.required_colors.length > 0 ||
        event.suggested_colors.length > 0 ||
        event.off_limit_colors.length > 0 ||
        event.color_notes) && (
        <div className="mt-6 space-y-2 rounded-xl border border-sage-deep/20 bg-sage/60 p-4">
          <ColorSection title="Required" colors={event.required_colors} />
          <ColorSection title="Suggested" colors={event.suggested_colors} />
          <ColorSection title="Off-limit" colors={event.off_limit_colors} />
          {event.color_notes && <p className="text-sm text-stone-muted">{event.color_notes}</p>}
        </div>
      )}

      <div className="mt-8">
        <OutfitPostForm
          eventId={event.id}
          inviteCode={event.invite_code}
          requiredColors={event.required_colors}
          offLimitColors={event.off_limit_colors}
          takenCounts={colorCounts}
          inspoUrls={event.inspo_image_urls}
          hostName={event.host_display_name}
          onPosted={() => {
            // The form just recorded the new post as ours; re-read so its
            // Edit/Delete buttons show without a reload.
            setMyPostIds(getMyPostIds(event.id))
            loadPosts()
          }}
        />
      </div>

      <div className="mt-10 flex items-baseline gap-5 border-b border-stone-line" role="tablist">
        {(
          [
            { key: 'feed', label: 'Outfits' },
            { key: 'gallery', label: `Gallery${photoCount > 0 ? ` · ${photoCount}` : ''}` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={view === t.key}
            onClick={() => setView(t.key)}
            className={`-mb-px border-b-2 pb-2 font-display text-2xl transition-colors ${
              view === t.key ? 'border-terracotta text-stone' : 'border-transparent text-stone-muted hover:text-stone'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'gallery' ? (
        <EventGallery inspoUrls={event.inspo_image_urls} hostName={event.host_display_name} posts={posts} />
      ) : (
      <>
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
      {posts.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-stone-line bg-white/60 px-5 py-8 text-center">
          <p className="font-display text-xl text-stone">No outfits yet</p>
          <p className="mt-1 text-sm text-stone-muted">
            Be the first to post what you&apos;re wearing, or post two options and let everyone vote.
          </p>
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
              {/* A poll's photos are its options, so only name/question are editable. */}
              {!post.is_poll && (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                  className="mb-2 block w-full text-xs text-stone-muted file:mr-2 file:rounded-full file:border-0 file:bg-terracotta-light file:px-3 file:py-1 file:text-xs file:font-medium file:text-terracotta-dark"
                />
              )}
              <input
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder={post.is_poll ? 'Question (optional)' : 'Caption (optional)'}
                className={`${inputClass} mb-2`}
              />
              {!post.is_poll && (
                <div className="mb-3">
                  <SwatchPicker value={editColors} onChange={setEditColors} />
                  <ColorWarnings
                    selected={editColors}
                    required={event.required_colors}
                    offLimit={event.off_limit_colors}
                    takenCounts={countColors(posts, post.id)}
                  />
                </div>
              )}
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
            <div
              key={post.id}
              className={post.is_poll ? 'col-span-full rounded-lg border border-stone-line bg-white p-3' : ''}
            >
              {post.is_poll ? (
                <PollCard
                  displayName={post.display_name}
                  caption={post.caption}
                  options={post.options ?? []}
                  myVote={post.my_vote}
                  totalVotes={post.total_votes}
                  isMine={myPostIds.includes(post.id)}
                  busy={busyPostId === post.id}
                  onVote={(optionId) => handleVote(post, optionId)}
                  onPickWinner={(optionId) => handlePickWinner(post, optionId)}
                />
              ) : (
                <>
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
                </>
              )}
              <div className="mt-1 flex items-center gap-3">
                {!post.is_poll && (
                  <button
                    onClick={() => handleToggleLike(post)}
                    disabled={busyPostId === post.id}
                    aria-pressed={post.liked_by_me}
                    aria-label={post.liked_by_me ? 'Unlike' : 'Like'}
                    className={`flex items-center gap-1 text-xs transition-colors ${
                      post.liked_by_me ? 'text-terracotta' : 'text-stone-muted hover:text-terracotta'
                    }`}
                  >
                    {/* Keyed on liked state so the pop replays each time you like it. */}
                    <span
                      key={post.liked_by_me ? 'liked' : 'unliked'}
                      className={`inline-block text-sm leading-none ${post.liked_by_me ? 'animate-pop' : ''}`}
                    >
                      {post.liked_by_me ? '♥' : '♡'}
                    </span>
                    {post.like_count > 0 && post.like_count}
                  </button>
                )}
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
      </>
      )}
    </div>
  )
}
