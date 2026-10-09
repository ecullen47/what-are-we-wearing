import { supabase } from '@/lib/supabase'

// Supabase pauses free-tier projects after about a week without activity,
// which takes the whole site down for guests until someone restores it.
// A Vercel Cron job (see vercel.json) calls this once a day; running a real
// query counts as activity and keeps the project awake.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // If CRON_SECRET is set in Vercel, its cron sends it as a bearer token;
  // reject anything else. Unset, the route is open, which is harmless:
  // it only runs a lookup for a code that never exists.
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 })
  }

  const { error } = await supabase.rpc('get_event_by_code', { p_code: 'KEEPALIVE' })
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 502 })
  }
  return Response.json({ ok: true, at: new Date().toISOString() })
}
