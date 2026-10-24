import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Body, Button, Label, styles as ui } from '@/components/ui'
import { ColorChip, SwatchPicker } from '@/components/Swatch'
import {
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
import { MAX_OUTFIT_COLORS, resolveColor, toPaletteId } from '@/lib/shared'
import { colors, fonts } from '@/theme'

export default function PostOutfit() {
  const router = useRouter()
  const params = useLocalSearchParams<{ code: string }>()
  const code = normalizeCode(params.code ?? '')

  const [event, setEvent] = useState<EventData | null>(null)
  const [takenCounts, setTakenCounts] = useState<Map<string, number>>(new Map())
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState<PickedPhoto | null>(null)
  const [caption, setCaption] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getEvent(code), getPosts(code)])
      .then(([eventData, posts]) => {
        if (cancelled || !eventData) return
        setEvent(eventData)
        setName((current) => current || getGuestName(eventData.id))
        const counts = new Map<string, number>()
        for (const p of posts) for (const c of p.colors ?? []) counts.set(c, (counts.get(c) ?? 0) + 1)
        setTakenCounts(counts)
      })
      .catch(() => setMessage("Couldn't load the event. Check your connection."))
    return () => {
      cancelled = true
    }
  }, [code])

  const offLimit = useMemo(() => new Set((event?.off_limit_colors ?? []).map(toPaletteId)), [event])
  const clashes = picked.filter((c) => offLimit.has(c))
  const alreadyWorn = picked.filter((c) => !offLimit.has(c) && (takenCounts.get(c) ?? 0) > 0)
  const missingRequired = (event?.required_colors ?? []).map(toPaletteId).filter((c) => !picked.includes(c))

  const choose = async (source: 'library' | 'camera') => {
    setMessage('')
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        setMessage('Camera access is off. You can turn it on in Settings, or choose a photo instead.')
        return
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options)
    const asset = result.canceled ? null : result.assets[0]
    if (asset) setPhoto({ uri: asset.uri, width: asset.width, height: asset.height })
  }

  const submit = async () => {
    if (!event) return
    if (!name.trim()) {
      setMessage('Please enter your name.')
      return
    }
    if (!photo) {
      setMessage('Please choose a photo of your outfit.')
      return
    }
    setSubmitting(true)
    setMessage('')
    let imageUrl: string | null = null
    try {
      setGuestName(event.id, name.trim())
      imageUrl = await uploadOutfitPhoto(event.id, photo)
      const postId = await insertOutfitPost({
        code,
        name: name.trim(),
        imageUrl,
        caption: caption.trim() || null,
        colors: picked,
      })
      addMyPostId(event.id, postId)
      await announceEventChange(event.id)
      router.back()
    } catch (err) {
      // The post wasn't saved, so an uploaded photo would be an orphan.
      if (imageUrl) await removeOutfitPhotos([imageUrl])
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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Body muted>{event.name}</Body>

        {photo ? (
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

        <View style={styles.photoButtons}>
          <View style={{ flex: 1 }}>
            <Button
              title={photo ? 'Choose another' : 'Choose photo'}
              variant="outline"
              onPress={() => choose('library')}
            />
          </View>
          {Platform.OS !== 'web' && (
            <View style={{ flex: 1 }}>
              <Button title="Take photo" variant="outline" onPress={() => choose('camera')} />
            </View>
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
          <Label>Caption (optional)</Label>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="e.g. Emerald slip dress"
            placeholderTextColor={colors.stoneMuted}
            maxLength={500}
            accessibilityLabel="Caption"
            style={ui.input}
          />
        </View>

        <View style={styles.field}>
          <Label>Outfit colors (optional)</Label>
          <SwatchPicker value={picked} onChange={setPicked} max={MAX_OUTFIT_COLORS} />
          <Body muted style={styles.hint}>
            {picked.length === 0
              ? `Tap up to ${MAX_OUTFIT_COLORS} main colors.`
              : `${picked.map((c) => resolveColor(c)?.label ?? c).join(', ')}`}
          </Body>
          {clashes.length > 0 && (
            <View style={[styles.warning, styles.warningStrong]}>
              <Body style={styles.warningText}>The host asked guests to avoid:</Body>
              <View style={styles.chips}>
                {clashes.map((c) => (
                  <ColorChip key={c} value={c} tone="warn" />
                ))}
              </View>
            </View>
          )}
          {alreadyWorn.length > 0 && (
            <View style={styles.warning}>
              <Body style={styles.warningText}>
                Heads up:{' '}
                {alreadyWorn
                  .map((c) => {
                    const n = takenCounts.get(c) ?? 0
                    return `${n} ${n === 1 ? 'person is' : 'people are'} already wearing ${resolveColor(c)?.label ?? c}`
                  })
                  .join('; ')}
                .
              </Body>
            </View>
          )}
          {picked.length > 0 && missingRequired.length > 0 && (
            <Body muted style={styles.hint}>
              The host asked everyone to wear {missingRequired.map((c) => resolveColor(c)?.label ?? c).join(', ')}.
            </Body>
          )}
        </View>

        {message ? <Body style={styles.error}>{message}</Body> : null}
        <Button title={clashes.length > 0 ? 'Post anyway' : 'Post outfit'} onPress={submit} busy={submitting} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  scroll: { padding: 20, paddingBottom: 48, gap: 18 },
  compare: { flexDirection: 'row', gap: 10 },
  compareCol: { flex: 1, gap: 4 },
  compareImage: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: colors.creamDark },
  compareLabel: { textAlign: 'center', fontSize: 13, fontFamily: fonts.sansMedium },
  inspo: { width: 96, height: 128, borderRadius: 10, backgroundColor: colors.creamDark },
  photoButtons: { flexDirection: 'row', gap: 10 },
  field: { gap: 8 },
  hint: { fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  warning: { backgroundColor: colors.butter, borderRadius: 10, padding: 12, gap: 8 },
  warningStrong: { backgroundColor: colors.terracottaLight },
  warningText: { fontSize: 14 },
  error: { color: colors.terracottaDark },
})
