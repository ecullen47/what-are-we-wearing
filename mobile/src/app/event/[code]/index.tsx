import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Body, Button, Card, Heading, Label } from '@/components/ui'
import { ColorChip } from '@/components/Swatch'
import { OutfitCard, PollCard } from '@/components/PostCard'
import PhotoViewer from '@/components/PhotoViewer'
import {
  closeDuePolls,
  deleteOwnPost,
  getEvent,
  getPosts,
  normalizeCode,
  pickPollWinner,
  removeOutfitPhotos,
  toggleLike,
  voteOnPoll,
  type EventData,
  type OutfitPost,
} from '@/lib/api'
import { useEventLive } from '@/lib/eventLive'
import { getMyPostIds, rememberEvent, removeMyPostId } from '@/lib/guestIdentity'
import { confirm, notify } from '@/lib/confirm'
import { countdownLabel, eventTypeLabel, formatEventDate } from '@/lib/shared'
import { colors, eventTypeTint, fonts } from '@/theme'

export default function EventScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ code: string }>()
  const code = normalizeCode(params.code ?? '')

  const [event, setEvent] = useState<EventData | null>(null)
  const [posts, setPosts] = useState<OutfitPost[]>([])
  const [myPostIds, setMyPostIds] = useState<string[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'notFound' | 'offline'>('loading')
  const [refreshing, setRefreshing] = useState(false)
  const [busyPostId, setBusyPostId] = useState<string | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [eventData, postData] = await Promise.all([getEvent(code), getPosts(code)])
      if (!eventData) {
        setStatus('notFound')
        return
      }
      setEvent(eventData)
      setPosts(postData)
      setMyPostIds(getMyPostIds(eventData.id))
      setStatus('ready')
      rememberEvent({
        code,
        name: eventData.name?.trim() || 'Untitled event',
        eventDate: eventData.event_date,
        eventType: eventData.event_type,
      })
    } catch {
      setStatus((s) => (s === 'ready' ? s : 'offline'))
    }
  }, [code])

  // Initial load, and again when coming back from the post screen.
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const announceChange = useEventLive(event?.id, load)

  // Close polls whose deadline has passed (on load, or the moment it passes
  // while open), as the web app does. The server decides what's actually due.
  const posting = useRef(false)
  useEffect(() => {
    const deadlines = posts.filter((p) => p.is_poll && p.poll_closes_at).map((p) => Date.parse(p.poll_closes_at!))
    if (deadlines.length === 0) return
    const wait = Math.max(0, Math.min(...deadlines) - Date.now())
    const timer = setTimeout(
      async () => {
        if (posting.current) return
        posting.current = true
        try {
          const losers = await closeDuePolls(code)
          if (losers.length === 0) return
          await removeOutfitPhotos(losers)
          await load()
          announceChange()
        } catch {
          // Next refresh tries again.
        } finally {
          posting.current = false
        }
      },
      Math.min(wait + (wait > 0 ? 1000 : 0), 2_000_000_000)
    )
    return () => clearTimeout(timer)
  }, [posts, code, load, announceChange])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const handleLike = async (post: OutfitPost) => {
    // Flip right away so the heart responds on tap; the reload corrects it.
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, liked_by_me: !p.liked_by_me, like_count: p.like_count + (p.liked_by_me ? -1 : 1) }
          : p
      )
    )
    setBusyPostId(post.id)
    try {
      await toggleLike(code, post.id)
      announceChange()
    } catch {
      notify("Couldn't save your like", 'Check your connection and try again.')
    }
    await load()
    setBusyPostId(null)
  }

  const handleVote = async (post: OutfitPost, optionId: string) => {
    setBusyPostId(post.id)
    try {
      await voteOnPoll(code, optionId)
      announceChange()
    } catch {
      notify("Couldn't count your vote", 'Check your connection and try again.')
    }
    await load()
    setBusyPostId(null)
  }

  const handlePickWinner = async (post: OutfitPost, optionId: string) => {
    const n = (post.options ?? []).findIndex((o) => o.id === optionId) + 1
    if (!(await confirm(`Wear option ${n}?`, 'This closes the poll and keeps only that photo.', 'Wear it'))) return
    setBusyPostId(post.id)
    try {
      const otherPhotos = await pickPollWinner(code, post.id, optionId)
      // The other options are no longer referenced, so clean them up.
      await removeOutfitPhotos(otherPhotos)
      announceChange()
    } catch {
      notify("Couldn't close your poll", 'Check your connection and try again.')
    }
    await load()
    setBusyPostId(null)
  }

  const handleDelete = async (post: OutfitPost) => {
    if (!event) return
    if (!(await confirm('Delete this post?', 'Everyone will stop seeing it.', 'Delete'))) return
    try {
      await deleteOwnPost(code, post.id)
      removeMyPostId(event.id, post.id)
      // The post is gone, so its photos are unreferenced and deletable.
      await removeOutfitPhotos([post.image_url, ...(post.options ?? []).map((o) => o.image_url)])
      announceChange()
    } catch {
      notify("Couldn't delete your post", 'Check your connection and try again.')
    }
    await load()
  }

  const colorCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of posts) for (const c of p.colors ?? []) counts.set(c, (counts.get(c) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [posts])

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.terracotta} />
      </View>
    )
  }

  if (status === 'notFound' || status === 'offline' || !event) {
    return (
      <View style={styles.center}>
        <Heading style={{ textAlign: 'center' }}>
          {status === 'offline' ? "Can't reach the event" : 'Event not found'}
        </Heading>
        <Body muted style={{ textAlign: 'center', marginTop: 8 }}>
          {status === 'offline'
            ? 'Check your connection and try again.'
            : 'Double-check the invite code. The event may also have been deleted by its host.'}
        </Body>
        <View style={{ marginTop: 20 }}>
          {status === 'offline' ? (
            <Button title="Try again" onPress={() => { setStatus('loading'); load() }} />
          ) : (
            <Button title="Back to home" variant="outline" onPress={() => router.back()} />
          )}
        </View>
      </View>
    )
  }

  const tint = eventTypeTint(event.event_type)
  const countdown = countdownLabel(event.event_date)
  const hasColorRules =
    event.required_colors.length + event.suggested_colors.length + event.off_limit_colors.length > 0 ||
    !!event.color_notes

  const header = (
    <View style={styles.header}>
      <View style={styles.badges}>
        <View style={[styles.badge, { backgroundColor: tint.bg }]}>
          <Body style={[styles.badgeText, { color: tint.fg }]}>{eventTypeLabel(event.event_type)}</Body>
        </View>
        {countdown && (
          <View style={[styles.badge, { backgroundColor: colors.terracottaLight }]}>
            <Body style={[styles.badgeText, { color: colors.terracottaDark }]}>{countdown}</Body>
          </View>
        )}
      </View>

      <Heading style={styles.title}>{event.name?.trim() || 'Untitled event'}</Heading>
      {event.host_display_name && <Body muted>Hosted by {event.host_display_name}</Body>}
      <Body>
        {formatEventDate(event.event_date)}
        {event.location ? ` · ${event.location}` : ''}
      </Body>

      {event.dress_code_text ? (
        <View style={styles.dressCode}>
          <Label style={{ color: colors.blushDeep }}>Dress code</Label>
          <Heading style={styles.dressCodeText}>{event.dress_code_text}</Heading>
        </View>
      ) : null}

      {event.inspo_image_urls.length > 0 && (
        <View>
          <Label style={styles.sectionLabel}>
            The inspo{event.host_display_name ? ` from ${event.host_display_name}` : ''}
          </Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inspoRow}>
            {event.inspo_image_urls.map((url, i) => (
              <Pressable key={url} onPress={() => setPhoto(url)} accessibilityLabel={`View inspo photo ${i + 1}`}>
                <Image source={url} style={styles.inspo} contentFit="cover" transition={150} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {hasColorRules && (
        <Card style={styles.colorRules}>
          <ColorRow title="Required" values={event.required_colors} />
          <ColorRow title="Suggested" values={event.suggested_colors} />
          <ColorRow title="Off-limit" values={event.off_limit_colors} warn />
          {event.color_notes ? <Body muted>{event.color_notes}</Body> : null}
        </Card>
      )}

      <Button
        title="Post your outfit"
        onPress={() => router.push({ pathname: '/event/[code]/post', params: { code } })}
      />

      <View style={styles.feedHeading}>
        <Heading style={{ fontSize: 24 }}>Outfits</Heading>
        {colorCounts.length > 0 && (
          <View style={styles.chips}>
            {colorCounts.slice(0, 6).map(([c, n]) => (
              <View key={c} style={styles.countChip}>
                <ColorChip value={c} />
                <Body muted style={{ fontSize: 12 }}>×{n}</Body>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Stack.Screen options={{ title: '' }} />
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Card style={styles.empty}>
            <Heading style={{ fontSize: 20, textAlign: 'center' }}>No outfits yet</Heading>
            <Body muted style={{ textAlign: 'center' }}>
              Be the first to post what you&apos;re wearing.
            </Body>
          </Card>
        }
        renderItem={({ item }) =>
          item.is_poll ? (
            <PollCard
              post={item}
              isMine={myPostIds.includes(item.id)}
              busy={busyPostId === item.id}
              onVote={(optionId) => handleVote(item, optionId)}
              onPickWinner={(optionId) => handlePickWinner(item, optionId)}
              onDelete={() => handleDelete(item)}
              onOpenPhoto={setPhoto}
            />
          ) : (
            <OutfitCard
              post={item}
              isMine={myPostIds.includes(item.id)}
              busy={busyPostId === item.id}
              onLike={() => handleLike(item)}
              onDelete={() => handleDelete(item)}
              onOpenPhoto={setPhoto}
            />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.terracotta} />}
      />
      <PhotoViewer url={photo} onClose={() => setPhoto(null)} />
    </SafeAreaView>
  )
}

function ColorRow({ title, values, warn }: { title: string; values: string[]; warn?: boolean }) {
  if (values.length === 0) return null
  return (
    <View style={styles.colorRow}>
      <Body style={styles.colorRowTitle}>{title}</Body>
      <View style={styles.chips}>
        {values.map((v) => (
          <ColorChip key={v} value={v} tone={warn ? 'warn' : undefined} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.cream },
  list: { padding: 20, paddingBottom: 40 },
  header: { gap: 14, marginBottom: 14 },
  badges: { flexDirection: 'row', gap: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.sansMedium, fontSize: 12 },
  title: { fontSize: 34, lineHeight: 40 },
  dressCode: {
    backgroundColor: colors.blush,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 4,
  },
  dressCodeText: { fontSize: 22, lineHeight: 28 },
  sectionLabel: { marginBottom: 8 },
  inspoRow: { gap: 8 },
  inspo: { width: 110, height: 146, borderRadius: 10, backgroundColor: colors.creamDark },
  colorRules: { backgroundColor: colors.sage, borderColor: 'transparent', gap: 10 },
  colorRow: { gap: 6 },
  colorRowTitle: { fontFamily: fonts.sansBold, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  countChip: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  feedHeading: { marginTop: 10, gap: 8 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 28 },
})
