'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SwatchDot } from '@/components/ColorChip'

type GalleryItem = {
  kind: 'inspo' | 'outfit'
  image_url: string
  event_type: string
  dress_code: string | null
  colors: string[]
  shared_at: string
}

const EVENT_TYPES = [
  { value: null, label: 'All' },
  { value: 'wedding', label: 'Weddings' },
  { value: 'dinner', label: 'Dinners' },
  { value: 'party', label: 'Parties' },
  { value: 'other', label: 'Other' },
] as const

const TYPE_LABEL: Record<string, string> = { wedding: 'Wedding', dinner: 'Dinner', party: 'Party', other: 'Event' }

const PAGE_SIZE = 24

export default function GalleryPage() {
  const router = useRouter()
  const [eventType, setEventType] = useState<string | null>(null)
  const [items, setItems] = useState<GalleryItem[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchPage = useCallback(
    async (offset: number) => {
      const { data } = await supabase.rpc('get_public_gallery', {
        p_event_type: eventType,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      })
      return (data as GalleryItem[] | null) ?? []
    },
    [eventType]
  )

  // The gallery is for logged-in users only (the database function is also
  // only granted to authenticated users).
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data?.user) {
        router.push('/login')
        return
      }
      setItems(null)
      const page = await fetchPage(0)
      setItems(page)
      setHasMore(page.length === PAGE_SIZE)
    }
    load()
  }, [fetchPage, router])

  const loadMore = async () => {
    if (!items) return
    setLoadingMore(true)
    const page = await fetchPage(items.length)
    setItems([...items, ...page])
    setHasMore(page.length === PAGE_SIZE)
    setLoadingMore(false)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/dashboard" className="text-sm text-terracotta hover:underline">
        &larr; Back to Dashboard
      </Link>
      <h1 className="mt-3 font-display text-3xl text-stone">Inspo Gallery</h1>
      <p className="mt-1 text-sm text-stone-muted">
        Inspiration and real outfits that hosts and guests chose to share. No names, places, or dates.
      </p>

      <div className="mt-5 flex flex-wrap gap-2" role="tablist">
        {EVENT_TYPES.map((t) => (
          <button
            key={t.label}
            role="tab"
            aria-selected={eventType === t.value}
            onClick={() => setEventType(t.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              eventType === t.value
                ? 'bg-terracotta text-cream'
                : 'border border-stone-line bg-white text-stone-muted hover:border-terracotta hover:text-terracotta'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {items === null ? (
        <p className="mt-10 text-center text-stone-muted">Loading...</p>
      ) : items.length === 0 ? (
        <p className="mt-10 text-center text-stone-muted">
          Nothing shared here yet. Hosts can share an event&apos;s inspo from its edit page.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {items.map((item, i) => (
              <figure key={`${item.image_url}-${i}`}>
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image_url}
                    alt={`${item.kind === 'inspo' ? 'Inspiration' : 'Outfit'} for a ${TYPE_LABEL[item.event_type] ?? 'event'}`}
                    loading="lazy"
                    className="aspect-[3/4] w-full rounded-lg object-cover"
                  />
                  <span className="absolute top-1.5 left-1.5 rounded-full bg-cream/90 px-2 py-0.5 text-[10px] font-medium text-stone">
                    {item.kind === 'inspo' ? 'Inspo' : 'Outfit'}
                  </span>
                </div>
                <figcaption className="mt-1.5 text-xs text-stone">
                  <span className="font-medium">{TYPE_LABEL[item.event_type] ?? 'Event'}</span>
                  {item.dress_code && <span className="text-stone-muted"> &middot; {item.dress_code}</span>}
                </figcaption>
                {item.colors.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.colors.map((c) => (
                      <SwatchDot key={c} value={c} />
                    ))}
                  </div>
                )}
              </figure>
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-full border border-terracotta px-6 py-2 text-sm font-medium text-terracotta transition-colors hover:bg-terracotta-light disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
