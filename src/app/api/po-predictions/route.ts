// src/app/api/po-predictions/route.ts
// Broker-only API — returns PO predictions + staged tráficos
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
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

  const companyId = session.companyId
  if (!companyId) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sin empresa' } }, { status: 401 })
  }

  try {
    const [predictions, staged, accuracy] = await Promise.all([
      supabase
        .from('po_predictions')
        .select('*')
        .eq('company_id', companyId)
        .in('status', ['active', 'matched'])
        .order('predicted_date', { ascending: true })
        .limit(50),
      supabase
        .from('staged_traficos')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'staged')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('po_prediction_accuracy')
        .select('overall_score, timing_error_days, value_error_pct')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    // Compute accuracy stats
    const scores = (accuracy.data || []).map(a => a.overall_score).filter(Boolean)
    const avgAccuracy = scores.length > 0
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length * 100)
      : null

    return NextResponse.json({
      data: {
        predictions: predictions.data || [],
        staged: staged.data || [],
        accuracy: {
          avg_score: avgAccuracy,
          total_matched: scores.length,
          avg_timing_error: scores.length > 0
            ? Math.round((accuracy.data || []).reduce((s: number, a: { timing_error_days: number | null }) => s + (a.timing_error_days || 0), 0) / scores.length)
            : null,
        },
      },
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ data: null, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 })
  }
}
