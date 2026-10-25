import * as Crypto from 'expo-crypto'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { supabase } from './supabase'

// Same treatment as the web app's lib/uploadImage.ts: photos are shown at
// most a few hundred points wide, so shrink to 1600px on the long side and
// re-encode as JPEG before uploading over phone data.
const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.85
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export type PickedPhoto = { uri: string; width: number; height: number }

async function resize(photo: PickedPhoto): Promise<string> {
  // Read the real size from the rendered image: pickers may report 0 for
  // width/height, and leaving one side null for the library to work out
  // fails on web. So resize with both sides given explicitly.
  let image = await ImageManipulator.manipulate(photo.uri).renderAsync()
  const longSide = Math.max(image.width, image.height)
  if (longSide > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / longSide
    const context = ImageManipulator.manipulate(photo.uri)
    context.resize({ width: Math.round(image.width * scale), height: Math.round(image.height * scale) })
    image = await context.renderAsync()
  }
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY })
  return saved.uri
}

// Uploads to the outfit-posts bucket under the event's folder and returns
// the public URL, matching the web's `${eventId}/${uuid}-${name}` paths.
export async function uploadOutfitPhoto(eventId: string, photo: PickedPhoto): Promise<string> {
  const uri = await resize(photo)
  const body = await (await fetch(uri)).arrayBuffer()
  if (body.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('That photo is over 10 MB even after shrinking. Please choose another.')
  }

  const path = `${eventId}/${Crypto.randomUUID()}-photo.jpg`
  const { error } = await supabase.storage.from('outfit-posts').upload(path, body, { contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from('outfit-posts').getPublicUrl(path).data.publicUrl
}
