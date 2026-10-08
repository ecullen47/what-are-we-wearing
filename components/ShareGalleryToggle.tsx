// Host's opt-in for the public inspo gallery. Shared on setup and edit so
// the wording (and what it does and doesn't reveal) stays identical.
export default function ShareGalleryToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-stone">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-terracotta"
      />
      <span>
        Share this event&apos;s inspo in the public gallery
        <span className="mt-0.5 block text-xs text-stone-muted">
          Logged-in users can browse your inspo images, and guests can choose to share their own outfits. Only the
          event type, dress code, and colors are shown, never names, places, dates, or your invite code.
        </span>
      </span>
    </label>
  )
}
