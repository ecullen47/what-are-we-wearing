'use client'

import { useEffect } from 'react'

export type ViewerPhoto = {
  key: string
  url: string
  alt: string
  caption?: React.ReactNode
}

// Full-screen viewer for a set of photos. Tap outside or press Esc to
// close; the arrows (or ← →) step through. Render it only while open.
export default function PhotoViewer({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: ViewerPhoto[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}) {
  const count = photos.length
  const photo = photos[index]
  const step = (delta: number) => onIndexChange((index + delta + count) % count)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (count > 1 && e.key === 'ArrowRight') onIndexChange((index + 1) % count)
      if (count > 1 && e.key === 'ArrowLeft') onIndexChange((index - 1 + count) % count)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, count, onClose, onIndexChange])

  // No background scrolling while the viewer is up.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  if (!photo) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone/90 p-4"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-cream/15 text-2xl text-cream hover:bg-cream/25"
      >
        &times;
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[75vh] max-w-full rounded-lg object-contain"
      />

      <div onClick={(e) => e.stopPropagation()} className="mt-3 max-w-md text-center text-sm text-cream">
        {photo.caption}
        {count > 1 && (
          <p className="mt-1 text-xs text-cream/60">
            {index + 1} / {count}
          </p>
        )}
      </div>

      {count > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              step(-1)
            }}
            aria-label="Previous photo"
            className="absolute top-1/2 left-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-cream/15 text-2xl text-cream hover:bg-cream/25"
          >
            &lsaquo;
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              step(1)
            }}
            aria-label="Next photo"
            className="absolute top-1/2 right-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-cream/15 text-2xl text-cream hover:bg-cream/25"
          >
            &rsaquo;
          </button>
        </>
      )}
    </div>
  )
}
