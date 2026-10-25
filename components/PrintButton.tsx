'use client'

export default function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-full bg-terracotta px-5 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-dark"
    >
      {label}
    </button>
  )
}
