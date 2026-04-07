// src/app/api/audit-risk/route.ts
// Broker-only API — returns audit risk assessments
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
    const { data: assessments } = await supabase
      .from('audit_risk_assessments')
      .select('*')
      .eq('company_id', companyId)
      .order('assessment_date', { ascending: false })
      .limit(12) // ~3 months of weekly assessments

    return NextResponse.json({
      data: {
        current: (assessments || [])[0] || null,
        history: assessments || [],
      },
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ data: null, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 })
  }
}
