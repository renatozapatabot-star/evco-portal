/**
 * Sync watchdog — independent failure-domain alert (2026-04-28).
 *
 * Vercel cron polls this endpoint every 5 minutes. It reads the most
 * recent successful `globalpc_delta` row from `sync_log` and Telegrams
 * if it's older than `STALE_MIN`. Critical: this watchdog runs OFF
 * Throne so it can still alert when Throne dies.
 *
 * Companion to scripts/watchdog.js (which lives on Throne and dies
 * with Throne) — addresses the silent-stop incident on 2026-04-24.
 *
 * Auth:
 *   - Vercel native cron: `authorization: Bearer <CRON_SECRET>` header
 *     (Vercel sets this automatically when CRON_SECRET is in env).
 *   - Manual: `x-cron-secret` header OR `?secret=` query param.
 *
 * No tenant data read — only `sync_log` (machine table). Tenant-isolation
 * contracts unaffected.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const DEFAULT_STALE_MIN = 30
const SYNC_TYPE = 'globalpc_delta'

interface WatchdogResult {
  verdict: 'green' | 'red'
  sync_type: string
  last_success_iso: string | null
  minutes_ago: number | null
  threshold_min: number
  alerted: boolean
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('x-cron-secret') ?? req.headers.get('authorization') ?? ''
  const bearer = header.replace(/^Bearer\s+/i, '').trim()
  const query = req.nextUrl.searchParams.get('secret') ?? ''
  return bearer === secret || query === secret
}

/**
 * Mirrors scripts/lib/telegram.js — single Telegram POST with the same
 * env gates. Inlined here so the route handler is self-contained
 * (route handlers don't load /scripts/lib).
 */
async function sendTelegram(msg: string): Promise<boolean> {
  if (process.env.TELEGRAM_SILENT === 'true') return false
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chat = process.env.TELEGRAM_CHAT_ID || '-5085543275'
  if (!token) return false
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: msg, parse_mode: 'HTML' }),
    })
    return res.ok
  } catch {
    return false
  }
}

function formatStaleAlert(
  syncType: string,
  lastSuccessIso: string | null,
  minutesAgo: number | null,
): string {
  const parts: string[] = []
  parts.push(`🔴 <b>${syncType} sync silent</b>`)
  if (lastSuccessIso && minutesAgo !== null) {
    const hours = Math.floor(minutesAgo / 60)
    const mins = minutesAgo % 60
    const rel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
    const d = new Date(lastSuccessIso)
    const dmy = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
    const hm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`
    parts.push(`Último éxito: ${dmy} ${hm} (hace ${rel})`)
  } else {
    parts.push('Sin registros de éxito previos.')
  }
  parts.push('Acción: revisar <code>pm2 status</code> en Throne y <code>pm2 logs globalpc-delta-sync</code>.')
  return parts.join('\n')
}

async function runWatchdog(): Promise<WatchdogResult> {
  const thresholdMin = Number(process.env.SYNC_WATCHDOG_STALE_MIN) || DEFAULT_STALE_MIN
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('sync_log')
    .select('completed_at, status')
    .eq('sync_type', SYNC_TYPE)
    .eq('status', 'success')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ completed_at: string | null; status: string | null }>()

  // On query error, treat as red but do not alert (we don't know the
  // real state). Surface the diagnostic in the response.
  if (error) {
    return {
      verdict: 'red',
      sync_type: SYNC_TYPE,
      last_success_iso: null,
      minutes_ago: null,
      threshold_min: thresholdMin,
      alerted: false,
    }
  }

  const lastSuccessIso = data?.completed_at ?? null
  const minutesAgo = lastSuccessIso
    ? Math.max(0, Math.floor((Date.now() - new Date(lastSuccessIso).getTime()) / 60_000))
    : null

  const isStale = minutesAgo === null || minutesAgo > thresholdMin
  let alerted = false

  if (isStale) {
    alerted = await sendTelegram(formatStaleAlert(SYNC_TYPE, lastSuccessIso, minutesAgo))
  }

  return {
    verdict: isStale ? 'red' : 'green',
    sync_type: SYNC_TYPE,
    last_success_iso: lastSuccessIso,
    minutes_ago: minutesAgo,
    threshold_min: thresholdMin,
    alerted,
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Cron secret requerido.' } },
      { status: 401 },
    )
  }
  const result = await runWatchdog()
  return NextResponse.json(
    { data: result, error: null },
    {
      // 503 when stale so Vercel cron logs surface the failure too;
      // 200 when green.
      status: result.verdict === 'red' ? 503 : 200,
      headers: { 'Cache-Control': 'no-store, private' },
    },
  )
}

export async function POST(req: NextRequest) {
  return GET(req)
}
