// The app's hanger mark (same shape as app/icon.svg), for placeholders and
// empty states. Uses currentColor so callers set the color with text-*.
export default function HangerMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M27 19a5 5 0 1 1 5 5v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M32 30 L12.5 43.5 Q10.5 45.5 13.5 45.5 H50.5 Q53.5 45.5 51.5 43.5 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
