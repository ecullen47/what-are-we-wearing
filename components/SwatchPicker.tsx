'use client'

import { useState } from 'react'
import { MAX_OUTFIT_COLORS, PALETTE, resolveColor } from '@/lib/palette'
import ColorChip from '@/components/ColorChip'

// A compact row of tappable palette swatches. Names appear on hover/focus
// (and as chips once picked) instead of under every circle, which keeps
// the picker to a few tidy rows. `ring` lets a caller color the selection
// outline (e.g. per host rule); `badge` adds a small corner mark.
export function SwatchGrid({
  isSelected,
  onToggle,
  ring,
  badge,
  isDisabled,
  hint,
  showCheck = true,
}: {
  isSelected: (id: string) => boolean
  onToggle: (id: string) => void
  ring?: (id: string) => string
  badge?: (id: string) => React.ReactNode
  isDisabled?: (id: string) => boolean
  // Shown under the swatches when none is hovered or focused.
  hint?: string
  // Checkmark on selected swatches. Off when a badge already says what the
  // selection means (a check on an off-limit color would read as "yes").
  showCheck?: boolean
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const hoveredLabel = hovered ? resolveColor(hovered)?.label : null

  return (
    <div>
      <div className="flex flex-wrap gap-2" onMouseLeave={() => setHovered(null)}>
        {PALETTE.map((c) => {
          const selected = isSelected(c.id)
          const disabled = !selected && isDisabled?.(c.id)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggle(c.id)}
              onMouseEnter={() => setHovered(c.id)}
              onFocus={() => setHovered(c.id)}
              onBlur={() => setHovered(null)}
              disabled={disabled}
              aria-pressed={selected}
              aria-label={c.label}
              title={c.label}
              className="relative rounded-full transition-transform hover:scale-110 focus-visible:scale-110 focus-visible:outline-none disabled:opacity-30 disabled:hover:scale-100"
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border border-stone/15 shadow-sm transition-shadow ${
                  selected ? `ring-2 ring-offset-2 ring-offset-cream ${ring?.(c.id) ?? 'ring-terracotta'}` : ''
                }`}
                style={{ background: c.swatch }}
              >
                {selected && showCheck && (
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5 drop-shadow-[0_0_1.5px_rgba(0,0,0,0.65)]"
                    aria-hidden="true"
                  >
                    <path
                      d="M3.5 8.5l3 3 6-7"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              {selected && badge?.(c.id)}
            </button>
          )
        })}
      </div>
      <p className="mt-2 h-4 text-xs text-stone-muted" aria-live="polite">
        {hoveredLabel ?? hint ?? ''}
      </p>
    </div>
  )
}

// Guest picker for tagging an outfit: up to MAX_OUTFIT_COLORS colors.
export default function SwatchPicker({
  value,
  onChange,
}: {
  value: string[]
  // Takes an updater (pass a useState setter) so rapid taps each build on
  // the latest state rather than the last-rendered one.
  onChange: (update: (prev: string[]) => string[]) => void
}) {
  const toggle = (id: string) =>
    onChange((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id].slice(0, MAX_OUTFIT_COLORS)
    )
  const full = value.length >= MAX_OUTFIT_COLORS

  return (
    <div>
      <SwatchGrid
        isSelected={(id) => value.includes(id)}
        onToggle={toggle}
        isDisabled={() => full}
        hint={
          value.length === 0
            ? `Tap up to ${MAX_OUTFIT_COLORS} main colors in your outfit.`
            : full
              ? `That's ${MAX_OUTFIT_COLORS}. Tap one to swap it out.`
              : `${value.length} of ${MAX_OUTFIT_COLORS} picked.`
        }
      />
      {value.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {value.map((id) => (
            <ColorChip key={id} value={id} onRemove={() => toggle(id)} />
          ))}
        </div>
      )}
    </div>
  )
}
