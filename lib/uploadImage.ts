import { supabase } from '@/lib/supabase'

type ImageBucket = 'event-inspo' | 'outfit-posts'

export async function uploadEventImage(
  bucket: ImageBucket,
  eventId: string,
  file: File
): Promise<string> {
  const path = `${eventId}/${crypto.randomUUID()}-${file.name}`

  const { error } = await supabase.storage.from(bucket).upload(path, file)
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}
