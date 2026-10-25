import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Live updates on the same Realtime broadcast channel as the web app's
// lib/eventLive.ts, so web and phone guests see each other's changes. The
// "changed" ping carries no data; listeners just re-fetch through the
// usual functions, so a fake ping can only cause an extra reload.

const CHANGED = 'changed'
const topic = (eventId: string) => `event:${eventId}`

type Entry = { channel: RealtimeChannel; listeners: Set<() => void>; closeTimer?: ReturnType<typeof setTimeout> }

// One channel per event shared by every screen. supabase.channel() hands
// back an existing channel for the same topic, so a second screen opening
// and closing its "own" channel would tear down the first one's. Closing
// is also delayed a moment so a quick remount reuses the channel.
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
// effort; anyone who misses it catches up on their next refresh.
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

// Calls onRemoteChange when someone else changes the event, and when the
// app returns to the foreground (it may have missed pings in the
// background). Bursts collapse into one call. Returns an announce function.
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
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh()
    })
    return () => {
      clearTimeout(timer)
      stopListening()
      sub.remove()
    }
  }, [eventId])

  return useCallback(() => {
    if (eventId) announceEventChange(eventId)
  }, [eventId])
}
