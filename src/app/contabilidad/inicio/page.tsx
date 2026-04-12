import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { ContabilidadClient } from './ContabilidadClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CROSSED_ESTATUS = ['Cruzado', 'Cancelado']

/**
 * Returns an ISO string for `daysAgo` days before today, at Laredo (CST/CDT) midnight.
 * Matches the bucketing used in /bodega/inicio for cross-cockpit consistency.
 */
function cstDayStart(daysAgo: number): string {
  const now = new Date()
  const laredoParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const y = Number(laredoParts.find((p) => p.type === 'year')?.value)
  const m = Number(laredoParts.find((p) => p.type === 'month')?.value)
  const d = Number(laredoParts.find((p) => p.type === 'day')?.value)
  const laredoMidnightUTC = Date.UTC(y, m - 1, d, 6, 0, 0)
  return new Date(laredoMidnightUTC - daysAgo * 86400_000).toISOString()
}

/** Returns ISO string for Laredo-local start of the current month. */
function cstMonthStart(): string {
  const now = new Date()
  const laredoParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const y = Number(laredoParts.find((p) => p.type === 'year')?.value)
  const m = Number(laredoParts.find((p) => p.type === 'month')?.value)
  return new Date(Date.UTC(y, m - 1, 1, 6, 0, 0)).toISOString()
}

export default async function ContabilidadInicioPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)

  if (!session) redirect('/login')
  if (!['contabilidad', 'admin', 'broker'].includes(session.role)) redirect('/inicio')

  const operatorName = cookieStore.get('operator_name')?.value || 'Anabel'

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const monthStart = cstMonthStart()
  const ninetyDaysStart = cstDayStart(90)
  const weekStart = cstDayStart(7)
  const twoWeeksStart = cstDayStart(14)

  // Ambiguity: there is no single canonical "unbilled trafico" flag.
  // Proxy: count crossed tráficos in the last 90 days whose `trafico` number
  // does not yet appear in any `invoices.notes` row. If that proves noisy,
  // swap to a dedicated join table in a later phase.
  const [
    invoicesPendingCobroRes,
    invoicesOverdueRes,
    invoicesMonthRes,
    crossedTraficosRes,
    invoicedNotesRes,
    overdueThisWeekRes,
    overdueLastWeekRes,
    aduanetPendingRes,
  ] = await Promise.all([
    // Cuentas por cobrar: facturas emitidas no pagadas (status sent | viewed | draft)
    sb.from('invoices')
      .select('id', { count: 'exact', head: true })
      .in('status', ['sent', 'viewed', 'draft']),
    // Morosos: overdue OR due_date < today and not paid
    sb.from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'overdue'),
    // Facturas del mes — any invoice created since month start
    sb.from('invoices')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart),
    // Crossed tráficos last 90 days — denominator for pendientes de facturar
    sb.from('traficos')
      .select('trafico')
      .in('estatus', CROSSED_ESTATUS)
      .gte('fecha_llegada', ninetyDaysStart)
      .limit(5000),
    // Existing invoice "notes" field often carries the trafico number — use as lightweight index
    sb.from('invoices')
      .select('notes')
      .gte('created_at', ninetyDaysStart)
      .limit(5000),
    // Overdue count this week (for banner delta)
    sb.from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'overdue')
      .gte('created_at', weekStart),
    sb.from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'overdue')
      .gte('created_at', twoWeeksStart)
      .lt('created_at', weekStart),
    // Cuentas por pagar: aduanet_facturas with IGI/IVA/DTA but no fecha_pago
    sb.from('aduanet_facturas')
      .select('pedimento', { count: 'exact', head: true })
      .is('fecha_pago', null)
      .gte('fecha_factura', ninetyDaysStart),
  ])

  const invoicedTraficos = new Set<string>()
  for (const row of invoicedNotesRes.data ?? []) {
    const notes = (row as { notes: string | null }).notes
    if (!notes) continue
    // Best-effort extraction — trafico numbers are 4+ digits
    const match = notes.match(/\b\d{4,}\b/g)
    if (match) match.forEach((m) => invoicedTraficos.add(m))
  }
  const pendientesFacturar = (crossedTraficosRes.data ?? []).reduce((acc, row) => {
    const tr = (row as { trafico: string | null }).trafico
    if (tr && !invoicedTraficos.has(tr)) return acc + 1
    return acc
  }, 0)

  const kpis = {
    pendientesFacturar,
    cxCobrar: invoicesPendingCobroRes.count ?? 0,
    cxPagar: aduanetPendingRes.count ?? 0,
    morososCount: invoicesOverdueRes.count ?? 0,
    facturasMes: invoicesMonthRes.count ?? 0,
    thisWeekOverdue: overdueThisWeekRes.count ?? 0,
    lastWeekOverdue: overdueLastWeekRes.count ?? 0,
  }

  return <ContabilidadClient operatorName={operatorName} kpis={kpis} />
}
