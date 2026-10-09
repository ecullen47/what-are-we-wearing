'use client'

import { useEffect, useState } from 'react'
import { TOAST_EVENT } from '@/lib/toast'

type Toast = { id: number; message: string }

const TOAST_MS = 2600

// Renders messages sent with toast() from lib/toast. Mounted once in the
// root layout.
export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    let nextId = 0
    const onToast = (e: Event) => {
      const id = nextId++
      const message = (e as CustomEvent<string>).detail
      setToasts((prev) => [...prev, { id, message }])
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_MS)
    }
    window.addEventListener(TOAST_EVENT, onToast)
    return () => window.removeEventListener(TOAST_EVENT, onToast)
  }, [])

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-toast-in rounded-full bg-stone px-5 py-2.5 text-sm font-medium text-cream shadow-lg"
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
