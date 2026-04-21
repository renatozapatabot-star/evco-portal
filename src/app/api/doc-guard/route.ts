import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PORTAL_DATE_FROM } from '@/lib/data'
import { verifySession } from '@/lib/session'
import { sanitizeFilter } from '@/lib/sanitize'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const REQUIRED_DOCS = [
  { type: 'FACTURA_COMERCIAL', critical: true, label: 'Factura Comercial', patterns: ['factura', 'invoice', 'commercial'] },
  { type: 'PACKING_LIST', critical: true, label: 'Packing List', patterns: ['packing', 'empaque'] },
  { type: 'BILL_OF_LADING', critical: true, label: 'Bill of Lading', patterns: ['lading', 'conocimiento', 'bl', 'carta_porte'] },
  { type: 'COVE', critical: true, label: 'COVE', patterns: ['cove', 'valor'] },
  { type: 'MVE', critical: true, label: 'MVE Folio', patterns: ['mve', 'manifestacion'] },
  { type: 'USMCA', critical: false, label: 'Certificado T-MEC', patterns: ['usmca', 'tmec', 'origen', 'certificate'] },
  { type: 'PEDIMENTO', critical: false, label: 'Pedimento Draft', patterns: ['pedimento'] },
]

export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const trafico = req.nextUrl.searchParams.get('trafico')
  if (!trafico) return NextResponse.json({ error: 'Missing trafico param' }, { status: 400 })
  const safe = sanitizeFilter(trafico)

  const [docsRes, traficoRes, dupsRes] = await Promise.all([
    supabase.from('documents').select('document_type, doc_type').or(`trafico_id.eq.${safe},metadata->>trafico.eq.${safe}`),
    supabase.from('traficos').select('mve_folio, pedimento').eq('trafico', safe).gte('fecha_llegada', PORTAL_DATE_FROM).single(),
    supabase.from('duplicates_detected').select('*').or(`trafico_id_1.eq.${safe},trafico_id_2.eq.${safe}`).eq('status', 'pending'),
  ])

  const docs = docsRes.data || []
  const traficoData = traficoRes.data
  const duplicates = dupsRes.data || []
  const docTypes = docs.map(d => ((d.document_type || d.doc_type || '')).toLowerCase())

  const required = REQUIRED_DOCS.map(rd => {
    let present = rd.patterns.some(p => docTypes.some(dt => dt.includes(p)))

    // Special checks
    if (rd.type === 'MVE' && traficoData?.mve_folio) present = true
    if (rd.type === 'PEDIMENTO' && traficoData?.pedimento) present = true

    return { ...rd, present }
  })

  const missingCritical = required.filter(r => r.critical && !r.present).map(r => r.label)
  const score = Math.round((required.filter(r => r.present).length / required.length) * 100)
  const canTransmit = missingCritical.length === 0 && duplicates.length === 0

  const blockers: string[] = [...missingCritical.map(d => `Falta: ${d}`)]
  if (duplicates.length > 0) blockers.push(`${duplicates.length} posible(s) factura(s) duplicada(s)`)

  return NextResponse.json({
    ready: canTransmit,
    score,
    required,
    missing_critical: missingCritical,
    can_transmit: canTransmit,
    blockers,
    duplicates: duplicates.length,
  })
}
