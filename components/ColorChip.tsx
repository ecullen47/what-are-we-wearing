import { resolveColor } from '@/lib/palette'

export function SwatchDot({ value, size = 'h-3.5 w-3.5' }: { value: string; size?: string }) {
  const color = resolveColor(value)
  if (!color) return null
  return (
    <span
      title={color.label}
      className={`inline-block shrink-0 rounded-full border border-stone/20 ${size}`}
      style={{ background: color.swatch }}
    />
  )
}

// Shows a palette color as swatch + label, or a legacy free-text value
// (from before hosts picked from the palette) as plain text.
export default function ColorChip({
  value,
  count,
  onRemove,
}: {
  value: string
  count?: number
  onRemove?: () => void
}) {
  const color = resolveColor(value)
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-line bg-white py-0.5 pr-2.5 pl-1 text-xs text-stone">
      {color ? <SwatchDot value={value} /> : <span className="pl-1" />}
      {color ? color.label : value}
      {count !== undefined && <span className="text-stone-muted">&times;{count}</span>}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${color ? color.label : value}`}
          className="ml-0.5 text-stone-muted hover:text-terracotta-dark"
        >
          &times;
        </button>
      )}
    </span>
  )
}
