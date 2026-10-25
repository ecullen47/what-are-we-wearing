import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Body, Button, Label, styles as ui } from '@/components/ui'
import { SwatchPicker } from '@/components/Swatch'
import ColorWarnings, { countColors, offLimitMatches } from '@/components/ColorWarnings'
import {
  createOutfitPoll,
  getEvent,
  getPosts,
  insertOutfitPost,
  normalizeCode,
  removeOutfitPhotos,
  type EventData,
} from '@/lib/api'
import { announceEventChange } from '@/lib/eventLive'
import { addMyPostId, getGuestName, setGuestName } from '@/lib/guestIdentity'
import { uploadOutfitPhoto, type PickedPhoto } from '@/lib/uploadImage'
import {
  MAX_OUTFIT_COLORS,
  MAX_POLL_OPTIONS,
  MIN_POLL_OPTIONS,
  pollClosesAt,
  pollDeadlineOptions,
  resolveColor,
  type DeadlineOptions,
} from '@/lib/shared'
import { colors, fonts } from '@/theme'

const toPicked = (a: ImagePicker.ImagePickerAsset): PickedPhoto => ({ uri: a.uri, width: a.width, height: a.height })

export default function PostOutfit() {
  const router = useRouter()
  const params = useLocalSearchParams<{ code: string }>()
  const code = normalizeCode(params.code ?? '')

  const [event, setEvent] = useState<EventData | null>(null)
  const [takenCounts, setTakenCounts] = useState<Map<string, number>>(new Map())
  const [mode, setMode] = useState<'outfit' | 'poll'>('outfit')
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState<PickedPhoto | null>(null)
  const [pollPhotos, setPollPhotos] = useState<PickedPhoto[]>([])
  // 'default' or one of DEADLINE_CHOICES.
  const [deadline, setDeadline] = useState('default')
  const [deadlineOptions, setDeadlineOptions] = useState<DeadlineOptions | null>(null)
  const [caption, setCaption] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getEvent(code), getPosts(code)])
      .then(([eventData, posts]) => {
        if (cancelled) return
        if (!eventData) {
          setMessage("We couldn't find this event.")
          return
        }
        setEvent(eventData)
        setName((current) => current || getGuestName(eventData.id))
        setTakenCounts(countColors(posts))
      })
      .catch(() => setMessage("Couldn't load the event. Check your connection."))
    return () => {
      cancelled = true
    }
  }, [code])

  const isPoll = mode === 'poll'
  const clashes = offLimitMatches(picked, event?.off_limit_colors ?? [])
  const pollFull = pollPhotos.length >= MAX_POLL_OPTIONS

  const switchMode = () => {
    if (!isPoll) {
      setDeadlineOptions(pollDeadlineOptions(event?.event_date ?? null))
      setDeadline('default')
    }
    setMode(isPoll ? 'outfit' : 'poll')
    setMessage('')
  }

  // In poll mode the library allows several picks at once (replacing the
  // current set) and the camera adds one photo at a time.
  const choose = async (source: 'library' | 'camera') => {
    setMessage('')
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        setMessage('Camera access is off. You can turn it on in Settings, or choose a photo instead.')
        return
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: isPoll && source === 'library',
      selectionLimit: isPoll ? MAX_POLL_OPTIONS : 1,
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options)
    if (result.canceled) return
    const assets = result.assets.map(toPicked)
    if (!isPoll) setPhoto(assets[0] ?? null)
    else if (source === 'camera') setPollPhotos((prev) => [...prev, ...assets].slice(0, MAX_POLL_OPTIONS))
    else setPollPhotos(assets.slice(0, MAX_POLL_OPTIONS))
  }

  const submit = async () => {
    if (!event) return
    if (!name.trim()) {
      setMessage('Please enter your name.')
      return
    }
    if (!isPoll && !photo) {
      setMessage('Please choose a photo of your outfit.')
      return
    }
    if (isPoll && pollPhotos.length < MIN_POLL_OPTIONS) {
      setMessage(`Choose ${MIN_POLL_OPTIONS} or ${MAX_POLL_OPTIONS} outfit photos for people to vote on.`)
      return
    }
    setSubmitting(true)
    setMessage('')
    const uploaded: string[] = []
    try {
      setGuestName(event.id, name.trim())
      for (const p of isPoll ? pollPhotos : [photo!]) uploaded.push(await uploadOutfitPhoto(event.id, p))
      const postId = isPoll
        ? await createOutfitPoll({
            code,
            name: name.trim(),
            imageUrls: uploaded,
            question: caption.trim() || null,
            closesAt: pollClosesAt(deadline),
          })
        : await insertOutfitPost({
            code,
            name: name.trim(),
            imageUrl: uploaded[0],
            caption: caption.trim() || null,
            colors: picked,
          })
      addMyPostId(event.id, postId)
      await announceEventChange(event.id)
      router.back()
    } catch (err) {
      // Nothing was saved, so any uploaded photos would be orphans.
      if (uploaded.length) await removeOutfitPhotos(uploaded)
      setMessage(err instanceof Error ? err.message : "Couldn't post. Please try again.")
      setSubmitting(false)
    }
  }

  if (!event) {
    return (
      <View style={styles.center}>
        {message ? <Body muted>{message}</Body> : <ActivityIndicator color={colors.terracotta} />}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isPoll ? 'Help me choose' : 'Post your outfit' }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Body muted>{event.name}</Body>

        <Pressable onPress={switchMode} accessibilityRole="button" style={styles.modeSwitch}>
          <Body style={styles.modeSwitchText}>
            {isPoll ? '← Back to posting one outfit' : "Can't decide? Post 2–3 options and let guests vote"}
          </Body>
        </Pressable>

        {isPoll ? (
          pollPhotos.length > 0 && (
            <View style={styles.compare}>
              {pollPhotos.map((p, i) => (
                <View key={p.uri} style={styles.compareCol}>
                  <Image source={p.uri} style={styles.compareImage} contentFit="cover" />
                  <Pressable
                    onPress={() => setPollPhotos((prev) => prev.filter((_, j) => j !== i))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove option ${i + 1}`}
                    style={styles.removeBadge}
                  >
                    <Text style={styles.removeText}>×</Text>
                  </Pressable>
                  <Body style={styles.compareLabel}>Option {i + 1}</Body>
                </View>
              ))}
            </View>
          )
        ) : photo ? (
          <View style={styles.compare}>
            <View style={styles.compareCol}>
              <Image source={photo.uri} style={styles.compareImage} contentFit="cover" />
              <Body style={styles.compareLabel}>Your look</Body>
            </View>
            {event.inspo_image_urls[0] && (
              <View style={styles.compareCol}>
                <Image source={event.inspo_image_urls[0]} style={styles.compareImage} contentFit="cover" />
                <Body muted style={styles.compareLabel}>
                  Inspo{event.inspo_image_urls.length > 1 ? ` 1 of ${event.inspo_image_urls.length}` : ''}
                </Body>
              </View>
            )}
          </View>
        ) : event.inspo_image_urls.length > 0 ? (
          <View>
            <Label style={{ marginBottom: 8 }}>The inspo</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {event.inspo_image_urls.map((url) => (
                <Image key={url} source={url} style={styles.inspo} contentFit="cover" />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.field}>
          <View style={styles.photoButtons}>
            <View style={{ flex: 1 }}>
              <Button
                title={isPoll ? (pollPhotos.length ? 'Choose again' : 'Choose photos') : photo ? 'Choose another' : 'Choose photo'}
                variant="outline"
                onPress={() => choose('library')}
              />
            </View>
            {Platform.OS !== 'web' && (
              <View style={{ flex: 1 }}>
                <Button
                  title={isPoll ? 'Add a photo' : 'Take photo'}
                  variant="outline"
                  disabled={isPoll && pollFull}
                  onPress={() => choose('camera')}
                />
              </View>
            )}
          </View>
          {isPoll && (
            <Body muted style={styles.hint}>
              {pollPhotos.length === 0
                ? `Choose ${MIN_POLL_OPTIONS} or ${MAX_POLL_OPTIONS} outfit photos.`
                : `${pollPhotos.length} of ${MAX_POLL_OPTIONS} photos chosen.`}
            </Body>
          )}
        </View>

        <View style={styles.field}>
          <Label>Your name</Label>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Shown with your post"
            placeholderTextColor={colors.stoneMuted}
            maxLength={100}
            accessibilityLabel="Your name"
            style={ui.input}
          />
        </View>

        <View style={styles.field}>
          <Label>{isPoll ? 'Question (optional)' : 'Caption (optional)'}</Label>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder={isPoll ? 'e.g. Which for the ceremony?' : 'e.g. Emerald slip dress'}
            placeholderTextColor={colors.stoneMuted}
            maxLength={500}
            accessibilityLabel={isPoll ? 'Question' : 'Caption'}
            style={ui.input}
          />
        </View>

        {isPoll ? (
          <View style={styles.field}>
            <Label>Voting closes</Label>
            <View style={styles.pills}>
              {[
                { value: 'default', label: `Before the event (${deadlineOptions?.defaultLabel ?? ''})` },
                ...(deadlineOptions?.choices ?? []),
              ].map((c) => {
                const on = deadline === c.value
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => setDeadline(c.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={[styles.pill, on && styles.pillOn]}
                  >
                    <Text style={[styles.pillText, on && { color: colors.cream }]}>{c.label}</Text>
                  </Pressable>
                )
              })}
            </View>
            <Body muted style={styles.hint}>
              Pick your outfit any time before then. If you don&apos;t, the top vote wins.
            </Body>
          </View>
        ) : (
          <View style={styles.field}>
            <Label>Outfit colors (optional)</Label>
            <SwatchPicker value={picked} onChange={setPicked} max={MAX_OUTFIT_COLORS} />
            <Body muted style={styles.hint}>
              {picked.length === 0
                ? `Tap up to ${MAX_OUTFIT_COLORS} main colors.`
                : picked.map((c) => resolveColor(c)?.label ?? c).join(', ')}
            </Body>
            <ColorWarnings
              picked={picked}
              required={event.required_colors}
              offLimit={event.off_limit_colors}
              takenCounts={takenCounts}
            />
          </View>
        )}

        {message ? <Body style={styles.error}>{message}</Body> : null}
        <Button
          title={isPoll ? 'Post poll' : clashes.length > 0 ? 'Post anyway' : 'Post outfit'}
          onPress={submit}
          busy={submitting}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  scroll: { padding: 20, paddingBottom: 48, gap: 18 },
  modeSwitch: { alignSelf: 'flex-start' },
  modeSwitchText: { color: colors.terracotta, fontFamily: fonts.sansMedium, fontSize: 14 },
  compare: { flexDirection: 'row', gap: 10 },
  compareCol: { flex: 1, gap: 4 },
  compareImage: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: colors.creamDark },
  compareLabel: { textAlign: 'center', fontSize: 13, fontFamily: fonts.sansMedium },
  removeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(250,243,236,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { fontFamily: fonts.sansBold, fontSize: 16, lineHeight: 18, color: colors.stone },
  inspo: { width: 96, height: 128, borderRadius: 10, backgroundColor: colors.creamDark },
  photoButtons: { flexDirection: 'row', gap: 10 },
  field: { gap: 8 },
  hint: { fontSize: 13 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1,
    borderColor: colors.terracotta,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillOn: { backgroundColor: colors.terracotta },
  pillText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.terracotta },
  error: { color: colors.terracottaDark },
})
