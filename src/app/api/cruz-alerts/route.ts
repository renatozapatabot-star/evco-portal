import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PORTAL_DATE_FROM } from '@/lib/data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

interface CruzAlert {
  icon: string
  title: string
  action: string
  prompt: string
}

export async function GET(request: NextRequest) {
  const clientClave = request.cookies.get('company_clave')?.value ?? ''
  const alerts: CruzAlert[] = []

  // Missing pedimento
  const { count: missingDocs } = await supabase
    .from('traficos')
    .select('id', { count: 'exact', head: true })
    .ilike('trafico', `${clientClave}-%`)
    .is('pedimento', null)
    .not('estatus', 'ilike', '%cruz%')
    .gte('fecha_llegada', PORTAL_DATE_FROM)

  if (missingDocs && missingDocs > 0) {
    alerts.push({
      icon: '\u26A0\uFE0F',
      title: `Tienes ${missingDocs} tr\u00E1fico${missingDocs > 1 ? 's' : ''} con documentos pendientes`,
      action: 'S\u00ED, prepara solicitudes \u2192',
      prompt: `Prepara solicitudes de documentos para los ${missingDocs} tr\u00E1ficos con documentos pendientes`,
    })
  }

  // Stale traficos (> 14 days without movement)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString()
  const { count: stale } = await supabase
    .from('traficos')
    .select('id', { count: 'exact', head: true })
    .ilike('trafico', `${clientClave}-%`)
    .not('estatus', 'ilike', '%cruz%')
    .lt('updated_at', fourteenDaysAgo)
    .gte('fecha_llegada', PORTAL_DATE_FROM)

  if (stale && stale > 0) {
    alerts.push({
      icon: '\u23F0',
      title: `${stale} tr\u00E1fico${stale > 1 ? 's' : ''} sin movimiento por m\u00E1s de 14 d\u00EDas`,
      action: 'Ver estatus \u2192',
      prompt: `Mu\u00E9strame los tr\u00E1ficos sin movimiento en los \u00FAltimos 14 d\u00EDas y recomienda acciones`,
    })
  }

  return NextResponse.json({ alerts })
}
