import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PORTAL_DATE_FROM } from '@/lib/data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString()

  const { data } = await supabase
    .from('traficos')
    .select('trafico, estatus, updated_at, company_id, pedimento')
    .gte('updated_at', twoHoursAgo)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .order('updated_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ changes: data || [] })
}
