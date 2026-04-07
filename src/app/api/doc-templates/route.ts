// src/app/api/doc-templates/route.ts
// Broker-only — returns document template network stats
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

  try {
    const { data: templates } = await supabase
      .from('document_templates')
      .select('*')
      .order('times_used', { ascending: false })
      .limit(100)

    const all = templates || []
    const withTurnaround = all.filter(t => t.typical_turnaround_hours)
    const avgTurnaround = withTurnaround.length > 0
      ? Math.round(withTurnaround.reduce((s: number, t: { typical_turnaround_hours: number }) => s + t.typical_turnaround_hours, 0) / withTurnaround.length)
      : null

    // Group by doc type
    const byType: Record<string, number> = {}
    for (const t of all) {
      byType[t.doc_type] = (byType[t.doc_type] || 0) + 1
    }

    return NextResponse.json({
      data: {
        templates: all,
        summary: {
          total_templates: all.length,
          unique_suppliers: new Set(all.map((t: { supplier_key: string }) => t.supplier_key)).size,
          avg_turnaround_hours: avgTurnaround,
          by_type: byType,
          total_uses: all.reduce((s: number, t: { times_used: number }) => s + (t.times_used || 0), 0),
        },
      },
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ data: null, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 })
  }
}
