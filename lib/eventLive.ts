'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Live updates for an event page, using Supabase Realtime broadcast.
//
// Guests read everything through security-definer functions rather than
// table SELECTs, so Postgres change feeds (which follow RLS) would show
// them nothing. Instead, whoever changes something sends a contentless
// "changed" ping on the event's channel, and everyone else viewing the
// event re-fetches through the same functions as always. The ping carries
// no data, so a fake one can only cause a harmless extra reload.

const CHANGED = 'changed'
const topic = (eventId: string) => `event:${eventId}`

type Entry = {
  channel: RealtimeChannel
  listeners: Set<() => void>
  closeTimer?: ReturnType<typeof setTimeout>
}

// One channel per event, shared by every listener on the page. Closing is
// delayed a moment so a quick unmount/remount (React dev mode, client-side
// navigation back) reuses the channel instead of racing its teardown.
const channels = new Map<string, Entry>()

function listen(eventId: string, listener: () => void): () => void {
  let entry = channels.get(eventId)
  if (entry) {
    clearTimeout(entry.closeTimer)
  } else {
    const listeners = new Set<() => void>()
    const channel = supabase
      .channel(topic(eventId))
      .on('broadcast', { event: CHANGED }, () => listeners.forEach((l) => l()))
      .subscribe()
    entry = { channel, listeners }
    channels.set(eventId, entry)
  }

  const current = entry
  current.listeners.add(listener)
  return () => {
    current.listeners.delete(listener)
    if (current.listeners.size > 0) return
    current.closeTimer = setTimeout(() => {
      channels.delete(eventId)
      supabase.removeChannel(current.channel)
    }, 1000)
  }
}

// Tell everyone else viewing this event that something changed. Best
// effort: if it doesn't get through, they still catch up the next time
// they return to the tab.
export async function announceEventChange(eventId: string): Promise<void> {
  try {
    const open = channels.get(eventId)
    if (open?.channel.state === 'joined') {
      // Over the open socket, which (unlike REST) doesn't echo back to us.
      await open.channel.send({ type: 'broadcast', event: CHANGED, payload: {} })
      return
    }
    if (open) {
      await open.channel.httpSend(CHANGED, {})
      return
    }
    // Nobody here is listening (e.g. the host's edit page), so use a
    // throwaway channel just to send.
    const channel = supabase.channel(topic(eventId))
    try {
      await channel.httpSend(CHANGED, {})
    } finally {
      await supabase.removeChannel(channel)
    }
  } catch {
    // Live updates are a nicety; never let them break a save.
  }
}

// Calls onRemoteChange when someone else changes this event, and when the
// tab comes back into view (a phone that was locked may have missed pings).
// Bursts are coalesced into one call. Returns a function to announce our
// own changes.
export function useEventLive(eventId: string | undefined, onRemoteChange: () => void): () => void {
  const callback = useRef(onRemoteChange)
  useEffect(() => {
    callback.current = onRemoteChange
  })

  useEffect(() => {
    if (!eventId) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => callback.current(), 300)
    }
    const stopListening = listen(eventId, refresh)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      stopListening()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [eventId])

  return useCallback(() => {
    if (eventId) announceEventChange(eventId)
  }, [eventId])
}
