import { resolveColor, toPaletteId } from '@/lib/palette'

function labelList(ids: string[]): string {
  const labels = ids.map((id) => resolveColor(id)?.label ?? id)
  if (labels.length <= 1) return labels.join('')
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

export function offLimitMatches(selected: string[], offLimit: string[]): string[] {
  const banned = new Set(offLimit.map(toPaletteId))
  return selected.filter((id) => banned.has(id))
}

// Live feedback while a guest tags their outfit. Nothing here blocks
// posting: off-limit is a strong warning, the rest are heads-ups.
export default function ColorWarnings({
  selected,
  required,
  offLimit,
  takenCounts,
}: {
  selected: string[]
  required: string[]
  offLimit: string[]
  // How many *other* posts use each color id.
  takenCounts: Map<string, number>
}) {
  if (selected.length === 0) return null

  const clashes = offLimitMatches(selected, offLimit)
  const requiredIds = required.map(toPaletteId).filter((id) => resolveColor(id))
  const missingRequired = requiredIds.length > 0 && !selected.some((id) => requiredIds.includes(id))
  const taken = selected.filter((id) => (takenCounts.get(id) ?? 0) > 0)

  if (clashes.length === 0 && !missingRequired && taken.length === 0) return null

  return (
    <div className="mt-3 space-y-1.5 text-xs">
      {clashes.length > 0 && (
        <p className="rounded-md border border-terracotta-dark/40 bg-terracotta-light px-3 py-2 font-medium text-terracotta-dark">
          Heads up: the host asked guests not to wear {labelList(clashes)}.
        </p>
      )}
      {missingRequired && (
        <p className="text-stone-muted">The host asked guests to wear {labelList(requiredIds)}.</p>
      )}
      {taken.map((id) => {
        const n = takenCounts.get(id)!
        return (
          <p key={id} className="text-stone-muted">
            {n} other {n === 1 ? 'guest is' : 'guests are'} wearing {resolveColor(id)?.label ?? id}.
          </p>
        )
      })}
    </div>
  )
}
