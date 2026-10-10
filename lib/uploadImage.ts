import { supabase } from '@/lib/supabase'

type ImageBucket = 'event-inspo' | 'outfit-posts'

// Mirrors the bucket limits set in the database, so users get a clear
// message up front instead of a raw storage error.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

// Photos are shown at most a few hundred pixels wide, so anything past this
// on the long side is wasted bytes for guests on phone data.
const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.85

// GIFs may be animated and SVGs are already small vectors; drawing either
// to a canvas would flatten them, so they upload untouched.
const SKIP_RESIZE = new Set(['image/gif', 'image/svg+xml'])

// Shrinks a photo to MAX_DIMENSION and re-encodes it as JPEG. Returns the
// original if the browser can't decode it (e.g. HEIC outside Safari) or if
// the result wouldn't actually be smaller.
async function resizeImage(file: File): Promise<File> {
  if (SKIP_RESIZE.has(file.type)) return file

  let bitmap: ImageBitmap
  try {
    // from-image applies the EXIF rotation, so phone photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    // JPEG has no transparency; without a fill, clear areas turn black.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    )
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^./]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}

export async function uploadEventImage(
  bucket: ImageBucket,
  eventId: string,
  original: File
): Promise<string> {
  if (!original.type.startsWith('image/')) {
    throw new Error(`"${original.name}" isn't an image. Please choose a photo.`)
  }
  // Resize before the size check, so a big phone photo gets shrunk to fit
  // instead of being turned away.
  const file = await resizeImage(original)
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`"${file.name}" is over 10 MB. Please choose a smaller photo.`)
  }

  const path = `${eventId}/${crypto.randomUUID()}-${file.name}`

  const { error } = await supabase.storage.from(bucket).upload(path, file)
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

// Public URLs look like .../storage/v1/object/public/<bucket>/<eventId>/<file>
export function storagePathFromPublicUrl(bucket: ImageBucket, url: string): string | null {
  const marker = `/object/public/${bucket}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length))
}

// Best effort: callers have already saved their change, so a failed
// cleanup just leaves an unused file behind rather than breaking anything.
export async function removeEventImages(bucket: ImageBucket, urls: string[]): Promise<void> {
  const paths = urls
    .map((url) => storagePathFromPublicUrl(bucket, url))
    .filter((p): p is string => !!p)
  if (paths.length > 0) {
    await supabase.storage.from(bucket).remove(paths)
  }
}

// Every file stored under an event's folder, for deleting the whole event.
export async function listEventFiles(bucket: ImageBucket, eventId: string): Promise<string[]> {
  const paths: string[] = []
  const pageSize = 100
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage.from(bucket).list(eventId, { limit: pageSize, offset })
    if (error || !data) break
    paths.push(...data.map((f) => `${eventId}/${f.name}`))
    if (data.length < pageSize) break
  }
  return paths
}
