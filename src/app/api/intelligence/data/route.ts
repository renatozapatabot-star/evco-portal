// src/app/api/intelligence/data/route.ts
// Broker-only API — returns intelligence sandbox data
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { INTELLIGENCE_TIERS } from '@/lib/intelligence'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  // Auth gate — broker/admin only
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } }, { status: 401 })
  }
  const role = session.role
  if (role !== 'broker' && role !== 'admin') {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Acceso restringido' } }, { status: 401 })
  }

  try {
    // Parallel fetch all data sections
    const [
      tierCounts,
      sandboxResults,
      shadowLog,
      lastTraining,
    ] = await Promise.all([
      // 1. Tier counts — how many traficos per tier
      fetchTierCounts(),
      // 2. Model performance from cruz_sandbox
      supabase
        .from('cruz_sandbox')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      // 3. Shadow predictions log
      supabase
        .from('shadow_training_log')
        .select('id, context_summary, score_overall, accepted_without_revision, corrections_count, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
      // 4. Last training run
      supabase
        .from('cruz_sandbox')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    // Compute running accuracy from shadow log
    const shadowRows = shadowLog.data || []
    const scoredRows = shadowRows.filter(r => r.score_overall != null)
    const avgAccuracy = scoredRows.length > 0
      ? scoredRows.reduce((sum, r) => sum + (r.score_overall || 0), 0) / scoredRows.length
      : null

    // Best accuracy from sandbox
    const sandboxRows = sandboxResults.data || []
    const bestAccuracy = sandboxRows.length > 0
      ? Math.max(...sandboxRows.map(r => r.accuracy_score || 0))
      : null

    return NextResponse.json({
      tiers: tierCounts,
      sandbox: sandboxRows,
      shadowLog: shadowRows,
      stats: {
        totalHistorical: tierCounts.historical,
        trainingSamples: tierCounts.analytical,
        bestAccuracy,
        avgShadowAccuracy: avgAccuracy,
        lastTrainingRun: lastTraining.data?.[0]?.created_at || null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function fetchTierCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}

  // Use parallel count queries for each tier
  const tierEntries = Object.entries(INTELLIGENCE_TIERS) as [string, { from: string }][]

  const results = await Promise.all(
    tierEntries.map(([key, tier]) =>
      supabase
        .from('traficos')
        .select('id', { count: 'exact', head: true })
        .gte('fecha_llegada', tier.from)
        .then(res => ({ key: key.toLowerCase(), count: res.count || 0 }))
    )
  )

  for (const { key, count } of results) {
    counts[key] = count
  }

  return counts
}
