import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const checks: Record<string, { ok: boolean; ms?: number }> = {}

  try {
    const start = Date.now()
    await supabase.from('traficos').select('trafico').limit(1)
    checks.supabase = { ok: true, ms: Date.now() - start }
  } catch { checks.supabase = { ok: false } }

  try {
    const start = Date.now()
    const { data } = await supabase.from('traficos').select('updated_at').order('updated_at', { ascending: false }).limit(1)
    const lastSync = data?.[0]?.updated_at
    const minsAgo = lastSync ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 60000) : null
    checks.sync = { ok: minsAgo !== null && minsAgo < 240, ms: minsAgo ?? undefined }
  } catch { checks.sync = { ok: false } }

  return NextResponse.json(checks, { headers: { 'Cache-Control': 's-maxage=60' } })
}
