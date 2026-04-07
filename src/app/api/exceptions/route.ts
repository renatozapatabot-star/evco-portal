// src/app/api/exceptions/route.ts
// Broker-only API — returns exception diagnoses
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
  if (role !== 'broker' && role !== 'admin') {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Acceso restringido' } }, { status: 401 })
  }

  const companyId = cookieStore.get('company_clave')?.value
  if (!companyId) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sin empresa' } }, { status: 401 })
  }

  try {
    const [open, resolved] = await Promise.all([
      supabase
        .from('exception_diagnoses')
        .select('*')
        .eq('company_id', companyId)
        .in('status', ['open', 'monitoring'])
        .order('detected_at', { ascending: false })
        .limit(50),
      supabase
        .from('exception_diagnoses')
        .select('id, trafico, exception_type, severity, primary_hypothesis, primary_confidence, status, resolved_at, hypothesis_correct, detected_at')
        .eq('company_id', companyId)
        .in('status', ['resolved', 'false_alarm'])
        .order('resolved_at', { ascending: false })
        .limit(20),
    ])

    const openItems = open.data || []
    const resolvedItems = resolved.data || []

    // Accuracy stats
    const withOutcome = resolvedItems.filter(r => r.hypothesis_correct !== null)
    const correctCount = withOutcome.filter(r => r.hypothesis_correct === true).length

    return NextResponse.json({
      data: {
        open: openItems,
        resolved: resolvedItems,
        summary: {
          total_open: openItems.length,
          critical: openItems.filter(e => e.severity === 'critical').length,
          high: openItems.filter(e => e.severity === 'high').length,
          total_resolved: resolvedItems.length,
          accuracy: withOutcome.length > 0 ? Math.round((correctCount / withOutcome.length) * 100) : null,
        },
      },
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ data: null, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 })
  }
}
