import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const sources = ['globalpc_delta', 'aduanet', 'soia', 'nightly']

  const sourceStatuses = await Promise.all(
    sources.map(async (source) => {
      const { data } = await supabase
        .from('scrape_runs')
        .select('started_at, completed_at, status, records_found, records_new, error_message')
        .eq('source', source)
        .order('started_at', { ascending: false })
        .limit(3)

      const last = data?.[0]
      const minutesAgo = last?.completed_at
        ? Math.round((Date.now() - new Date(last.completed_at).getTime()) / 60000)
        : null

      const intervalMinutes = { globalpc_delta: 15, aduanet: 30, soia: 15, nightly: 1440 }[source] || 30

      return {
        source,
        lastRun: last?.completed_at || null,
        minutesAgo,
        status: last?.status || 'unknown',
        recordsNew: last?.records_new || 0,
        healthy: minutesAgo !== null && minutesAgo < intervalMinutes * 3,
        recentRuns: data || []
      }
    })
  )

  return NextResponse.json({
    sources: sourceStatuses,
    allHealthy: sourceStatuses.every(s => s.healthy || s.status === 'unknown')
  })
}
