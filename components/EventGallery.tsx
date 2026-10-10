'use client'

import { useMemo, useState } from 'react'
import ColorChip, { SwatchDot } from '@/components/ColorChip'
import PhotoViewer from '@/components/PhotoViewer'

// Just the fields the gallery needs from an event's posts.
export type GalleryPost = {
  id: string
  display_name: string
  image_url: string
  caption: string | null
  colors: string[] | null
  is_poll: boolean
  options: { id: string; image_url: string; position: number }[] | null
}

type Item = {
  key: string
  url: string
  kind: 'inspo' | 'outfit' | 'poll'
  title: string
  detail: string | null
  colors: string[]
}

type Filter = 'all' | 'inspo' | 'outfits'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'inspo', label: 'Inspo' },
  { value: 'outfits', label: 'Outfits' },
]

const KIND_LABEL: Record<Item['kind'], string> = { inspo: 'Inspo', outfit: 'Outfit', poll: 'Poll option' }

// Every photo from one event in a single browsable grid: the host's inspo,
// guests' outfits, and open poll options. Tap a photo to view it full size.
export default function EventGallery({
  inspoUrls,
  hostName,
  posts,
}: {
  inspoUrls: string[]
  hostName: string | null
  posts: GalleryPost[]
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [color, setColor] = useState<string | null>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const items = useMemo<Item[]>(() => {
    const inspo: Item[] = inspoUrls.map((url) => ({
      key: `inspo-${url}`,
      url,
      kind: 'inspo',
      title: hostName ? `From ${hostName}` : 'From the host',
      detail: null,
      colors: [],
    }))
    const fromPosts = posts.flatMap<Item>((p) => {
      if (p.is_poll) {
        const options = [...(p.options ?? [])].sort((a, b) => a.position - b.position)
        return options.map((o, i) => ({
          key: `${p.id}-${o.id}`,
          url: o.image_url,
          kind: 'poll' as const,
          title: p.display_name,
          detail: `Option ${i + 1} of ${options.length}${p.caption ? ` · ${p.caption}` : ''}`,
          colors: [],
        }))
      }
      return [
        {
          key: p.id,
          url: p.image_url,
          kind: 'outfit' as const,
          title: p.display_name,
          detail: p.caption,
          colors: p.colors ?? [],
        },
      ]
    })
    return [...inspo, ...fromPosts]
  }, [inspoUrls, hostName, posts])

  const colorCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) for (const c of item.colors) counts.set(c, (counts.get(c) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [items])

  const visible = items.filter(
    (item) =>
      (filter === 'all' || (filter === 'inspo' ? item.kind === 'inspo' : item.kind !== 'inspo')) &&
      (!color || item.colors.includes(color))
  )

  if (items.length === 0) {
    return <p className="mt-4 text-sm text-stone-muted">No photos yet. Inspo and outfits will show up here.</p>
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setFilter(f.value)
              if (f.value === 'inspo') setColor(null)
            }}
            aria-pressed={filter === f.value}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-terracotta text-cream'
                : 'border border-stone-line bg-white text-stone-muted hover:border-terracotta hover:text-terracotta'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filter !== 'inspo' && colorCounts.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-stone-muted">Color:</span>
          {colorCounts.map(([c, n]) => (
            <button
              key={c}
              onClick={() => setColor(color === c ? null : c)}
              aria-pressed={color === c}
              className={`rounded-full ${color === c ? 'ring-2 ring-terracotta ring-offset-1 ring-offset-cream' : ''}`}
            >
              <ColorChip value={c} count={n} />
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-stone-muted">Nothing matches that filter yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visible.map((item, i) => (
            <button
              key={item.key}
              onClick={() => setOpenIndex(i)}
              className="group relative overflow-hidden rounded-lg text-left"
              aria-label={`View ${KIND_LABEL[item.kind].toLowerCase()}: ${item.title}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt=""
                loading="lazy"
                className="aspect-[3/4] w-full object-cover transition-transform group-hover:scale-[1.02]"
              />
              <span className="absolute top-1.5 left-1.5 rounded-full bg-cream/90 px-2 py-0.5 text-[10px] font-medium text-stone">
                {KIND_LABEL[item.kind]}
              </span>
            </button>
          ))}
        </div>
      )}

      {openIndex !== null && (
        <PhotoViewer
          photos={visible.map((item) => ({
            key: item.key,
            url: item.url,
            alt: `${KIND_LABEL[item.kind]}: ${item.title}`,
            caption: (
              <>
                <p>
                  <span className="text-cream/70">{KIND_LABEL[item.kind]} &middot; </span>
                  <strong>{item.title}</strong>
                  {item.detail && <span className="text-cream/80"> — {item.detail}</span>}
                </p>
                {item.colors.length > 0 && (
                  <div className="mt-1.5 flex justify-center gap-1">
                    {item.colors.map((c) => (
                      <SwatchDot key={c} value={c} size="h-4 w-4" />
                    ))}
                  </div>
                )}
              </>
            ),
          }))}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  )
}
