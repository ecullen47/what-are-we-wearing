'use client'

import { useState } from 'react'
import ColorChip from '@/components/ColorChip'
import { SwatchGrid } from '@/components/SwatchPicker'

export type ColorRules = {
  required: string[]
  suggested: string[]
  offLimit: string[]
}

type Category = keyof ColorRules

const CATEGORIES: { key: Category; label: string; ring: string; badge: React.ReactNode }[] = [
  {
    key: 'required',
    label: 'Required',
    ring: 'ring-stone',
    badge: <Badge className="bg-stone text-cream">R</Badge>,
  },
  {
    key: 'suggested',
    label: 'Suggested',
    ring: 'ring-terracotta',
    badge: <Badge className="bg-terracotta-light text-terracotta-dark">S</Badge>,
  },
  {
    key: 'offLimit',
    label: 'Off-limit',
    ring: 'ring-terracotta-dark',
    badge: <Badge className="bg-terracotta-dark text-cream">&times;</Badge>,
  },
]

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] leading-none font-bold ring-1 ring-cream ${className}`}
    >
      {children}
    </span>
  )
}

// Hosts tap a category tab, then tap swatches to add/remove them from it.
// A color can only be in one category, so adding it to one removes it
// from the others. Values should already be normalized with toPaletteId;
// any that aren't palette colors (older typed values) show as text chips.
export default function ColorRulesPicker({
  value,
  onChange,
}: {
  value: ColorRules
  // Takes an updater (pass a useState setter) so rapid taps each build on
  // the latest state rather than the last-rendered one.
  onChange: (update: (prev: ColorRules) => ColorRules) => void
}) {
  const [active, setActive] = useState<Category>('required')

  const categoryIn = (rules: ColorRules, id: string): Category | undefined =>
    CATEGORIES.find((c) => rules[c.key].includes(id))?.key
  const categoryOf = (id: string) => categoryIn(value, id)

  const toggle = (id: string) =>
    onChange((prev) => {
      const current = categoryIn(prev, id)
      const next: ColorRules = {
        required: prev.required.filter((v) => v !== id),
        suggested: prev.suggested.filter((v) => v !== id),
        offLimit: prev.offLimit.filter((v) => v !== id),
      }
      if (current !== active) next[active] = [...next[active], id]
      return next
    })

  const remove = (key: Category, v: string) =>
    onChange((prev) => ({ ...prev, [key]: prev[key].filter((x) => x !== v) }))

  return (
    <div>
      <div className="mb-4 flex rounded-full border border-stone-line bg-white p-1" role="tablist">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={active === c.key}
            onClick={() => setActive(c.key)}
            className={`flex-1 rounded-full px-2 py-1.5 text-xs font-medium transition-colors ${
              active === c.key ? 'bg-terracotta text-cream' : 'text-stone-muted hover:text-terracotta'
            }`}
          >
            {c.label}
            {value[c.key].length > 0 && ` (${value[c.key].length})`}
          </button>
        ))}
      </div>

      <SwatchGrid
        isSelected={(id) => categoryOf(id) !== undefined}
        onToggle={toggle}
        ring={(id) => CATEGORIES.find((c) => c.key === categoryOf(id))?.ring ?? 'ring-terracotta'}
        badge={(id) => CATEGORIES.find((c) => c.key === categoryOf(id))?.badge}
        showCheck={false}
        hint={`Tap colors to add them to ${CATEGORIES.find((c) => c.key === active)?.label}.`}
      />

      <div className="mt-2 space-y-2">
        {CATEGORIES.map((c) => (
          <div key={c.key} className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="w-20 shrink-0 text-xs font-medium text-stone">{c.label}:</span>
            {value[c.key].length === 0 ? (
              <span className="text-xs text-stone-muted">none</span>
            ) : (
              value[c.key].map((v) => <ColorChip key={v} value={v} onRemove={() => remove(c.key, v)} />)
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
