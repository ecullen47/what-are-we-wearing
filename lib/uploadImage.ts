import { supabase } from '@/lib/supabase'

type ImageBucket = 'event-inspo' | 'outfit-posts'

// Mirrors the bucket limits set in the database, so users get a clear
// message up front instead of a raw storage error.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export async function uploadEventImage(
  bucket: ImageBucket,
  eventId: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`"${file.name}" isn't an image. Please choose a photo.`)
  }
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
