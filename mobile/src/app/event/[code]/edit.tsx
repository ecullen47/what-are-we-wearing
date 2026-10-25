import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Body, Button, Label, styles as ui } from '@/components/ui'
import { SwatchPicker } from '@/components/Swatch'
import ColorWarnings, { countColors } from '@/components/ColorWarnings'
import {
  getEvent,
  getPosts,
  normalizeCode,
  removeOutfitPhotos,
  updateOwnPost,
  type EventData,
  type OutfitPost,
} from '@/lib/api'
import { announceEventChange } from '@/lib/eventLive'
import { getMyPostIds, setGuestName } from '@/lib/guestIdentity'
import { uploadOutfitPhoto, type PickedPhoto } from '@/lib/uploadImage'
import { MAX_OUTFIT_COLORS, resolveColor } from '@/lib/shared'
import { colors } from '@/theme'

// Edit one of your own posts, as the web's inline edit form does. A poll's
// photos are its options, so only its name and question can change.
export default function EditPost() {
  const router = useRouter()
  const params = useLocalSearchParams<{ code: string; post: string }>()
  const code = normalizeCode(params.code ?? '')

  const [event, setEvent] = useState<EventData | null>(null)
  const [post, setPost] = useState<OutfitPost | null>(null)
  const [takenCounts, setTakenCounts] = useState<Map<string, number>>(new Map())
  const [name, setName] = useState('')
  const [newPhoto, setNewPhoto] = useState<PickedPhoto | null>(null)
  const [caption, setCaption] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getEvent(code), getPosts(code)])
      .then(([eventData, posts]) => {
        if (cancelled) return
        const found = posts.find((p) => p.id === params.post)
        if (!eventData || !found || !getMyPostIds(eventData.id).includes(found.id)) {
          setMessage("This post isn't yours to edit, or it's been deleted.")
          return
        }
        setEvent(eventData)
        setPost(found)
        setName(found.display_name)
        setCaption(found.caption ?? '')
        setPicked(found.colors ?? [])
        setTakenCounts(countColors(posts, found.id))
      })
      .catch(() => setMessage("Couldn't load your post. Check your connection."))
    return () => {
      cancelled = true
    }
  }, [code, params.post])

  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
    const asset = result.canceled ? null : result.assets[0]
    if (asset) setNewPhoto({ uri: asset.uri, width: asset.width, height: asset.height })
  }

  const save = async () => {
    if (!event || !post) return
    if (!name.trim()) {
      setMessage('Please enter a name.')
      return
    }
    setSaving(true)
    setMessage('')
    let uploaded: string | null = null
    try {
      if (newPhoto) uploaded = await uploadOutfitPhoto(event.id, newPhoto)
      await updateOwnPost({
        code,
        postId: post.id,
        name: name.trim(),
        imageUrl: uploaded ?? post.image_url,
        caption: caption.trim() || null,
        colors: post.is_poll ? (post.colors ?? []) : picked,
      })
      setGuestName(event.id, name.trim())
      // The replaced photo is no longer referenced, so clean it up.
      if (uploaded) await removeOutfitPhotos([post.image_url])
      await announceEventChange(event.id)
      router.back()
    } catch (err) {
      if (uploaded) await removeOutfitPhotos([uploaded])
      setMessage(err instanceof Error ? err.message : "Couldn't save. Please try again.")
      setSaving(false)
    }
  }

  if (!event || !post) {
    return (
      <View style={styles.center}>
        {message ? <Body muted style={{ textAlign: 'center' }}>{message}</Body> : <ActivityIndicator color={colors.terracotta} />}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: post.is_poll ? 'Edit your poll' : 'Edit your post' }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {!post.is_poll && (
          <View style={styles.field}>
            <Image source={newPhoto?.uri ?? post.image_url} style={styles.photo} contentFit="cover" />
            <Button title="Change photo" variant="outline" onPress={choosePhoto} />
          </View>
        )}

        <View style={styles.field}>
          <Label>Your name</Label>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={100}
            accessibilityLabel="Your name"
            style={ui.input}
          />
        </View>

        <View style={styles.field}>
          <Label>{post.is_poll ? 'Question (optional)' : 'Caption (optional)'}</Label>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            maxLength={500}
            accessibilityLabel={post.is_poll ? 'Question' : 'Caption'}
            style={ui.input}
          />
        </View>

        {!post.is_poll && (
          <View style={styles.field}>
            <Label>Outfit colors (optional)</Label>
            <SwatchPicker value={picked} onChange={setPicked} max={MAX_OUTFIT_COLORS} />
            {picked.length > 0 && (
              <Body muted style={styles.hint}>
                {picked.map((c) => resolveColor(c)?.label ?? c).join(', ')}
              </Body>
            )}
            <ColorWarnings
              picked={picked}
              required={event.required_colors}
              offLimit={event.off_limit_colors}
              takenCounts={takenCounts}
            />
          </View>
        )}

        {message ? <Body style={styles.error}>{message}</Body> : null}
        <Button title="Save changes" onPress={save} busy={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  scroll: { padding: 20, paddingBottom: 48, gap: 18 },
  photo: { width: '60%', alignSelf: 'center', aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: colors.creamDark },
  field: { gap: 8 },
  hint: { fontSize: 13 },
  error: { color: colors.terracottaDark },
})
