import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function startScrapeRun(
  source: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const { data } = await supabase
    .from('scrape_runs')
    .insert({
      source,
      started_at: new Date().toISOString(),
      status: 'running',
      metadata
    })
    .select('id')
    .single()
  return data?.id || ''
}

export async function completeScrapeRun(
  id: string,
  stats: {
    records_found: number
    records_new: number
    records_updated: number
    error?: string
  }
) {
  await supabase.from('scrape_runs').update({
    completed_at: new Date().toISOString(),
    status: stats.error ? 'error' : 'success',
    records_found: stats.records_found,
    records_new: stats.records_new,
    records_updated: stats.records_updated,
    error_message: stats.error || null
  }).eq('id', id)
}

export async function getLastScrapeTime(source: string): Promise<Date | null> {
  const { data } = await supabase
    .from('scrape_runs')
    .select('completed_at')
    .eq('source', source)
    .eq('status', 'success')
    .order('completed_at', { ascending: false })
    .limit(1)

  return data?.[0]?.completed_at
    ? new Date(data[0].completed_at)
    : null
}
