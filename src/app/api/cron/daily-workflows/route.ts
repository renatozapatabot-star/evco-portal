/**
 * Cron endpoint for the 3 Killer Daily Driver Workflows.
 *
 * Runs after every 5-minute delta sync. Scoped to the tenants in
 * `SHADOW_MODE_COMPANIES` (Ursula at EVCO + MAFESA). Writes only
 * into `workflow_findings` — never triggers live actions.
 *
 * Auth:
 *   · GET  → requires `CRON_SECRET` header OR ?secret= query param.
 *            Same contract as scripts/semaforo-watch.js so Throne can
 *            call it with the same env var.
 *   · POST → same, plus an optional JSON body to scope to one
 *            `companyId` for a manual re-run from the operator UI.
 *
 * Response shape matches the `{ data, error }` envelope the rest of
 * /api uses so any downstream wrapper (Mensajería, alerts) can
 * consume without special-casing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import {
  runAllShadowWorkflows,
  runWorkflowsForCompany,
  type RunSummary,
} from '@/lib/workflows/runner'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('x-cron-secret') ?? req.headers.get('authorization') ?? ''
  const bearer = header.replace(/^Bearer\s+/i, '').trim()
  const query = req.nextUrl.searchParams.get('secret') ?? ''
  return bearer === secret || query === secret
}

function unauthorized() {
  return NextResponse.json(
    { data: null, error: { code: 'UNAUTHORIZED', message: 'Cron secret requerido.' } },
    { status: 401 },
  )
}

async function runAll(): Promise<RunSummary> {
  const supabase = createServerClient()
  return runAllShadowWorkflows(supabase)
}

async function runOne(companyId: string) {
  const supabase = createServerClient()
  return runWorkflowsForCompany(supabase, companyId)
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized()
  const summary = await runAll()
  return NextResponse.json({ data: summary, error: null })
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized()
  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  if (body && typeof body === 'object' && 'companyId' in body) {
    const companyId = String((body as { companyId?: unknown }).companyId ?? '').trim()
    if (!companyId) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'companyId requerido.' } },
        { status: 400 },
      )
    }
    const result = await runOne(companyId)
    return NextResponse.json({ data: result, error: null })
  }

  const summary = await runAll()
  return NextResponse.json({ data: summary, error: null })
}
