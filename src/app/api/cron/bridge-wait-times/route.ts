// CRUZ V1.5 · F18 — Bridge wait times cron endpoint.
//
// Vercel Hobby tier caps crons at daily granularity, so this handler
// doubles as:
//   1. The scheduled daily refresh (vercel.json).
//   2. An on-demand refresh callable from the stale-triggered read path.
//
// Writes a new snapshot batch; returns the latest rows.

import { NextResponse } from 'next/server'
import {
  fetchBridgeWaitTimes,
  persistBridgeWaits,
  getLatestBridgeWaits,
} from '@/lib/bridges/fetch'

export const dynamic = 'force-dynamic'

async function run() {
  const waits = await fetchBridgeWaitTimes()
  const inserted = await persistBridgeWaits(waits)
  const latest = await getLatestBridgeWaits()
  return NextResponse.json({
    data: { inserted, latest },
    error: null,
  })
}

export async function GET() {
  return run()
}

export async function POST() {
  return run()
}
