import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Module-level timestamp — set once when this serverless instance boots.
// instance_age_ms = now - moduleStart tells the dry-run whether it hit
// a cold start (module just booted) or a warm instance.
const moduleStartTime = Date.now()

export async function GET() {
  const now = Date.now()
  const instanceAgeMs = now - moduleStartTime
  // Heuristic: anything under 2 s since module boot is treated as a
  // cold start. Warm requests on a reused instance typically come
  // minutes later.
  const coldStart = instanceAgeMs < 2000

  const checks: {
    supabase?: { ok: boolean; ms?: number }
    sync?: { ok: boolean; ms?: number }
    cold_start: boolean
    instance_age_ms: number
  } = {
    cold_start: coldStart,
    instance_age_ms: instanceAgeMs,
  }

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

  // Don't cache cold-start telemetry — each request should reflect
  // the instance state at request time.
  return NextResponse.json(checks, { headers: { 'Cache-Control': 'no-store' } })
}
