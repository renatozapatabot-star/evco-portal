// src/app/api/profitability/route.ts
// Admin-only API — returns per-client profitability (Tito only)
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value
  if (role !== 'admin') {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Solo administrador' } }, { status: 401 })
  }

  try {
    // Get latest month for each company
    const { data: latest } = await supabase
      .from('client_profitability')
      .select('*')
      .order('month', { ascending: false })
      .limit(50)

    // Deduplicate: keep only most recent month per company
    const rows = latest || []
    const seen = new Set<string>()
    const current = rows.filter((row: { company_id: string }) => {
      if (seen.has(row.company_id)) return false
      seen.add(row.company_id)
      return true
    }).sort((a: { net_profit_usd?: number }, b: { net_profit_usd?: number }) =>
      (b.net_profit_usd || 0) - (a.net_profit_usd || 0)
    )

    // Get 6-month history for trend
    const { data: history } = await supabase
      .from('client_profitability')
      .select('company_id, month, net_profit_usd, operations_count, margin_pct')
      .order('month', { ascending: false })
      .limit(100)

    const totalRevenue = current.reduce((s, c) => s + (c.total_revenue_usd || 0), 0)
    const totalProfit = current.reduce((s, c) => s + (c.net_profit_usd || 0), 0)
    const totalOps = current.reduce((s, c) => s + (c.operations_count || 0), 0)

    return NextResponse.json({
      data: {
        clients: current,
        history: history || [],
        summary: {
          total_clients: current.length,
          profitable: current.filter(c => (c.net_profit_usd || 0) >= 0).length,
          unprofitable: current.filter(c => (c.net_profit_usd || 0) < 0).length,
          total_revenue_usd: Math.round(totalRevenue),
          total_profit_usd: Math.round(totalProfit),
          total_operations: totalOps,
          avg_margin_pct: current.length > 0
            ? Math.round(current.reduce((s, c) => s + (c.margin_pct || 0), 0) / current.length * 10) / 10
            : 0,
        },
      },
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ data: null, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 })
  }
}
