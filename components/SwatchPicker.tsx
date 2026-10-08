'use client'

import { MAX_OUTFIT_COLORS, PALETTE } from '@/lib/palette'

// A grid of tappable palette swatches. `ring` lets a caller color the
// selection outline (e.g. per host rule); `badge` adds a small corner mark.
export function SwatchGrid({
  isSelected,
  onToggle,
  ring,
  badge,
  isDisabled,
}: {
  isSelected: (id: string) => boolean
  onToggle: (id: string) => void
  ring?: (id: string) => string
  badge?: (id: string) => React.ReactNode
  isDisabled?: (id: string) => boolean
}) {
  return (
    <div className="grid grid-cols-5 gap-x-1 gap-y-2 sm:grid-cols-7">
      {PALETTE.map((c) => {
        const selected = isSelected(c.id)
        const disabled = !selected && isDisabled?.(c.id)
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggle(c.id)}
            disabled={disabled}
            aria-pressed={selected}
            aria-label={c.label}
            className="flex flex-col items-center gap-1 disabled:opacity-35"
          >
            <span className="relative">
              <span
                className={`block h-8 w-8 rounded-full border border-stone/20 transition-shadow ${
                  selected ? `ring-2 ring-offset-2 ring-offset-cream ${ring?.(c.id) ?? 'ring-terracotta'}` : ''
                }`}
                style={{ background: c.swatch }}
              />
              {selected && badge?.(c.id)}
            </span>
            <span className={`text-[10px] leading-tight ${selected ? 'font-medium text-stone' : 'text-stone-muted'}`}>
              {c.label}
            </span>
          </button>
        )
      })}
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

  return (
    <div>
      <SwatchGrid
        isSelected={(id) => value.includes(id)}
        onToggle={toggle}
        isDisabled={() => value.length >= MAX_OUTFIT_COLORS}
      />
      <p className="mt-2 text-xs text-stone-muted">
        {value.length === 0
          ? `Tap up to ${MAX_OUTFIT_COLORS} main colors in your outfit.`
          : `${value.length} of ${MAX_OUTFIT_COLORS} picked.`}
      </p>
    </div>
  )
}
