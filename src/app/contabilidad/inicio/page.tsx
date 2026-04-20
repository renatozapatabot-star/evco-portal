/**
 * CRUZ · /contabilidad/inicio — accounting cockpit (Anabel).
 *
 * v7+ canonical composition via CockpitInicio. All queries soft-wrapped
 * (invariant 34). Same 6 nav cards (invariant 29). Hero KPIs: CxC vencido,
 * CxP por pagar, MVE abiertos, Facturas listas.
 *
 * Internal accountants at the broker (contabilidad/admin/broker roles)
 * aggregate across all tenants — companyId passed as null to aging helpers.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { logOperatorAction } from '@/lib/operator-actions'
import { computeARAging, computeAPAging } from '@/lib/contabilidad/aging'
import { ensureMonthlyChecklist, monthAnchor } from '@/lib/contabilidad/close'
import { bucketDailySeries, sumRange, daysAgo } from '@/lib/cockpit/fetch'
import { softCount, softData, softFirst } from '@/lib/cockpit/safe-query'
import { auditLogAvailable } from '@/lib/cockpit/table-availability'
import { auditRowToTimelineItem, type AuditRow } from '@/lib/cockpit/audit-format'
import { fmtUSDCompact } from '@/lib/format-utils'
import {
  CockpitInicio,
  CockpitErrorCard,
  CockpitSkeleton,
  TimelineFeed,
  CapabilityCardGrid,
  GlassCard,
  SectionHeader,
  severityFromCount,
  type CockpitHeroKPI,
} from '@/components/aguila'
import type { NavCounts } from '@/lib/cockpit/nav-tiles'
import type { CapabilityCounts } from '@/lib/cockpit/capabilities'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const AGGREGATE_ROLES = new Set(['admin', 'broker', 'contabilidad'])

function withHardTimeout<T>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(p).catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export default async function ContabilidadInicioPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (!['contabilidad', 'admin', 'broker'].includes(session.role)) redirect('/inicio')

  const opName = cookieStore.get('operator_name')?.value || 'Anabel'
  const opId = cookieStore.get('operator_id')?.value || ''
  const scopedCompanyId: string | null = AGGREGATE_ROLES.has(session.role) ? null : session.companyId

  if (opId) {
    try {
      logOperatorAction({ operatorId: opId, actionType: 'view_page', targetId: '/contabilidad/inicio' })
    } catch { /* telemetry never crashes */ }
  }

  return (
    <Suspense fallback={<CockpitSkeleton />}>
      <ContabilidadCockpit opName={opName} scopedCompanyId={scopedCompanyId} />
    </Suspense>
  )
}

async function ContabilidadCockpit({ opName, scopedCompanyId }: { opName: string; scopedCompanyId: string | null }) {
  try {
    return await renderContabilidadCockpit(opName, scopedCompanyId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return <CockpitErrorCard message={`No se pudo cargar el cockpit de contabilidad: ${msg}`} />
  }
}

async function renderContabilidadCockpit(opName: string, scopedCompanyId: string | null) {
  const sb = createServerClient()
  const now = new Date()
  const month = monthAnchor()
  const sevenDaysAgoIso = daysAgo(7, now).toISOString()
  const fourteenDaysAgoIso = daysAgo(14, now).toISOString()
  const ninetyDaysAgoIso = daysAgo(90, now).toISOString()
  const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Resolve a concrete companyId for the checklist helper — it requires a
  // tenant anchor. Admin/broker/contabilidad fall back to '__aggregate__'
  // so the helper writes to a shared bucket.
  const checklistCompanyId = scopedCompanyId ?? '__aggregate__'

  const [
    ar,
    ap,
    close,
    mveRows,
    facturasReady,
    facturasSeriesRows,
    lastQb,
    cruzadosMesCount,
    entradasMesCount,
    entradasSeriesRows,
    expedientesCount,
    expedientesSeriesRows,
    pedimentosMesCount,
    pedimentosSeriesRows,
    catalogoCount,
    clasificacionesCount,
    clasificacionesSeriesRows,
    activosCount,
    activosSeriesRows,
    cruzados7dCount,
    lastPedimento,
    auditAvailable,
  ] = await Promise.all([
    withHardTimeout(computeARAging(sb, scopedCompanyId), 4000, {
      total: 0, count: 0, byBucket: [], topDebtors: [], currency: 'MXN' as const,
    }),
    withHardTimeout(computeAPAging(sb, scopedCompanyId), 4000, {
      total: 0, count: 0, byBucket: [], topDebtors: [], currency: 'MXN' as const,
    }),
    withHardTimeout(ensureMonthlyChecklist(sb, checklistCompanyId, month), 3000, []),
    softData<{ id: string; severity: string }>(
      (scopedCompanyId
        ? sb.from('mve_alerts').select('id, severity').eq('company_id', scopedCompanyId).eq('resolved', false)
        : sb.from('mve_alerts').select('id, severity').eq('resolved', false)
      ).limit(500)
    ),
    softData<{ id: string | number; invoice_number: string | null; total: number | null; currency: string | null; created_at: string; status: string }>(
      (scopedCompanyId
        ? sb.from('invoices').select('id, invoice_number, total, currency, created_at, status').eq('company_id', scopedCompanyId).eq('status', 'draft')
        : sb.from('invoices').select('id, invoice_number, total, currency, created_at, status').eq('status', 'draft')
      ).order('created_at', { ascending: false }).limit(5)
    ),
    softData<{ created_at: string }>(
      (scopedCompanyId
        ? sb.from('invoices').select('created_at').eq('company_id', scopedCompanyId).gte('created_at', fourteenDaysAgoIso)
        : sb.from('invoices').select('created_at').gte('created_at', fourteenDaysAgoIso)
      ).limit(2000)
    ),
    softFirst<{ id: string; status: string; row_count: number | null; entity: string; format: string; created_at: string; completed_at: string | null }>(
      (scopedCompanyId
        ? sb.from('quickbooks_export_jobs').select('id, status, row_count, entity, format, created_at, completed_at').eq('company_id', scopedCompanyId)
        : sb.from('quickbooks_export_jobs').select('id, status, row_count, entity, format, created_at, completed_at')
      ).order('created_at', { ascending: false }).limit(1)
    ),
    // Cruces este mes — real fecha_cruce, not updated_at.
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).gte('fecha_cruce', monthStartIso)),
    softCount(sb.from('entradas').select('cve_entrada', { count: 'exact', head: true }).gte('fecha_llegada_mercancia', monthStartIso)),
    softData<{ fecha_llegada_mercancia: string }>(
      sb.from('entradas').select('fecha_llegada_mercancia').gte('fecha_llegada_mercancia', fourteenDaysAgoIso).limit(2000)
    ),
    softCount(sb.from('expediente_documentos').select('id', { count: 'exact', head: true })),
    softData<{ uploaded_at: string }>(
      sb.from('expediente_documentos').select('uploaded_at').gte('uploaded_at', fourteenDaysAgoIso).limit(2000)
    ),
    // Pedimentos generados este mes — use fecha_cruce as the milestone.
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).not('pedimento', 'is', null).gte('fecha_cruce', monthStartIso)),
    softData<{ fecha_cruce: string }>(
      sb.from('traficos').select('fecha_cruce').not('pedimento', 'is', null).gte('fecha_cruce', fourteenDaysAgoIso).limit(2000)
    ),
    softCount(sb.from('globalpc_productos').select('id', { count: 'exact', head: true })),
    softCount(sb.from('globalpc_productos').select('id', { count: 'exact', head: true }).not('fraccion', 'is', null)),
    softData<{ fraccion_classified_at: string }>(
      sb.from('globalpc_productos').select('fraccion_classified_at').not('fraccion_classified_at', 'is', null).gte('fraccion_classified_at', fourteenDaysAgoIso).limit(2000)
    ),
    // Activos = pending cruce, recent arrival only (excludes historical ghosts).
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).is('fecha_cruce', null).gte('fecha_llegada', ninetyDaysAgoIso)),
    softData<{ fecha_llegada: string }>(
      sb.from('traficos').select('fecha_llegada').is('fecha_cruce', null).gte('fecha_llegada', fourteenDaysAgoIso).limit(2000)
    ),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).gte('fecha_cruce', sevenDaysAgoIso)),
    softFirst<{ fecha_cruce: string }>(
      sb.from('traficos').select('fecha_cruce').not('fecha_cruce', 'is', null).order('fecha_cruce', { ascending: false }).limit(1)
    ),
    withHardTimeout(auditLogAvailable(sb), 2000, false),
  ])

  const entradasSeries        = bucketDailySeries(entradasSeriesRows       as Array<Record<string, unknown>>, 'fecha_llegada_mercancia', 14, now)
  const expedientesSeries     = bucketDailySeries(expedientesSeriesRows    as Array<Record<string, unknown>>, 'uploaded_at', 14, now)
  const pedimentosSeries      = bucketDailySeries(pedimentosSeriesRows     as Array<Record<string, unknown>>, 'fecha_cruce', 14, now)
  const clasificacionesSeries = bucketDailySeries(clasificacionesSeriesRows as Array<Record<string, unknown>>, 'fraccion_classified_at', 14, now)
  const activosSeries         = bucketDailySeries(activosSeriesRows        as Array<Record<string, unknown>>, 'fecha_llegada', 14, now)
  const facturasSeries        = bucketDailySeries(facturasSeriesRows       as Array<Record<string, unknown>>, 'created_at', 14, now)

  const mveOpen = mveRows
  const mveCritical = mveOpen.filter((a) => a.severity === 'critical').length
  const mveWarning = mveOpen.filter((a) => a.severity === 'warning').length

  const arVencido = ar.byBucket
    .filter((b) => b.bucket !== '0-30')
    .reduce((acc, b) => acc + b.amount, 0)
  const apPorPagar = ap.total

  const closeOpen = close.filter((c) => !c.is_done).length
  const closeTotal = close.length

  const heroKPIs: CockpitHeroKPI[] = [
    { key: 'cxc',      label: 'CxC vencido',     value: fmtUSDCompact(arVencido) || '—', tone: 'silver', inverted: true, href: '/contabilidad/kpis' },
    { key: 'cxp',      label: 'CxP por pagar',   value: fmtUSDCompact(apPorPagar) || '—', tone: 'silver', inverted: true, href: '/contabilidad/kpis' },
    { key: 'mve',      label: 'MVE abiertos',    value: mveOpen.length, tone: 'silver', inverted: true, urgent: mveCritical > 0, href: '/cumplimiento' },
    { key: 'facturas', label: 'Facturas listas', value: facturasReady.length, series: facturasSeries, current: sumRange(facturasSeries, 7, 14), previous: sumRange(facturasSeries, 0, 7), tone: 'silver', href: '/contabilidad/exportar' },
  ]

  const daysSinceLastCruce = lastPedimento?.fecha_cruce
    ? Math.floor((Date.now() - new Date(lastPedimento.fecha_cruce).getTime()) / 86_400_000)
    : null

  const navCounts: NavCounts = {
    traficos:        { count: activosCount,         series: activosSeries,         microStatus: `${cruzados7dCount} cruzaron esta semana` },
    // 2026-04-19 override: own cockpit surface — self-referential
    // Contabilidad tile. Uses the AR aging already computed for the KPIs.
    contabilidad:    { count: ar.count ?? null,      series: [],                  microStatus: arVencido > 0 ? 'Saldos vencidos hoy' : 'Al corriente' },
    pedimentos:      { count: pedimentosMesCount,   series: pedimentosSeries,      microStatus: daysSinceLastCruce != null ? `Último cruce hace ${daysSinceLastCruce} día${daysSinceLastCruce === 1 ? '' : 's'}` : 'Sin cruces recientes' },
    expedientes:     { count: expedientesCount,     series: expedientesSeries,     microStatus: 'Documentos totales' },
    catalogo:        { count: catalogoCount,        series: [],                    microStatus: clasificacionesCount > 0 ? `${clasificacionesCount.toLocaleString('es-MX')} fracciones clasificadas` : 'Sin clasificar' },
    entradas:        { count: entradasMesCount,     series: entradasSeries,        microStatus: `${entradasMesCount} en ${now.toLocaleString('es-MX', { month: 'short', timeZone: 'America/Chicago' })}` },
    clasificaciones: { count: clasificacionesCount, series: clasificacionesSeries, microStatus: `${clasificacionesCount} fracciones clasificadas` },
  }

  let auditRows: AuditRow[] = []
  if (auditAvailable) {
    auditRows = await softData<AuditRow>(
      sb.from('audit_log')
        .select('id, table_name, action, record_id, changed_at, company_id')
        .in('action', ['draft_approved', 'draft_rejected', 'data_exported', 'pedimento_rechazado', 'mve_critical'])
        .order('changed_at', { ascending: false })
        .limit(15)
    )
  }
  const actividadItems = auditRows.map(auditRowToTimelineItem)

  const qbLastLine = lastQb
    ? `${new Date(lastQb.created_at).toLocaleDateString('es-MX', { timeZone: 'America/Chicago', day: '2-digit', month: 'short' })} · ${lastQb.row_count ?? 0} filas · ${lastQb.entity}`
    : 'Sin exportaciones recientes'

  const closeSeverity = severityFromCount(closeOpen, { warn: 3, crit: 6 })
  const mveSeverity = severityFromCount(mveCritical, { warn: 1, crit: 3 })

  const estadoSections = (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: 'var(--aguila-gap-card, 16px)',
    }}>
      <GlassCard padding={20} severity={closeSeverity}>
        <SectionHeader title="Cierre del mes" />
        <div style={{ marginTop: 8, fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 800, fontFamily: 'var(--font-jetbrains-mono), monospace', color: 'var(--portal-fg-1)' }}>
          {closeTotal - closeOpen}
          <span style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 500, color: 'rgba(230,237,243,0.55)', marginLeft: 6 }}>/ {closeTotal}</span>
        </div>
        <div style={{ fontSize: 'var(--aguila-fs-compact)', color: 'rgba(230,237,243,0.55)', marginTop: 4 }}>
          {closeOpen === 0 ? 'Checklist completo' : `${closeOpen} pendiente${closeOpen === 1 ? '' : 's'}`}
        </div>
      </GlassCard>

      <GlassCard padding={20} severity={mveSeverity}>
        <SectionHeader title="MVE" />
        <div style={{ marginTop: 8, fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 800, fontFamily: 'var(--font-jetbrains-mono), monospace', color: 'var(--portal-fg-1)' }}>
          {mveOpen.length}
        </div>
        <div style={{ fontSize: 'var(--aguila-fs-compact)', color: 'rgba(230,237,243,0.55)', marginTop: 4 }}>
          {mveCritical > 0 ? `${mveCritical} crítico${mveCritical === 1 ? '' : 's'} · ` : ''}
          {mveWarning} advertencia{mveWarning === 1 ? '' : 's'}
        </div>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader title="CxC por antigüedad" />
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {ar.byBucket.map((b) => (
            <div key={b.bucket} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'rgba(230,237,243,0.55)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{b.bucket}d</div>
              <div style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono), monospace', color: b.bucket === '90+' && b.amount > 0 ? 'var(--portal-status-amber-fg)' : 'var(--portal-fg-1)', marginTop: 2 }}>
                {fmtUSDCompact(b.amount) || '—'}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader title="Última exportación QB" />
        <div style={{ marginTop: 10, fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-1)', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
          {qbLastLine}
        </div>
        {lastQb ? (
          <div style={{ marginTop: 6, fontSize: 'var(--aguila-fs-meta)', color: 'rgba(230,237,243,0.55)' }}>
            estado: {lastQb.status}
          </div>
        ) : null}
        <a href="/contabilidad/exportar" style={{ display: 'inline-block', marginTop: 12, fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-1)', textDecoration: 'none', fontWeight: 600 }}>
          Exportar → QuickBooks
        </a>
      </GlassCard>
    </div>
  )

  // Capability cards moved to LauncherTray (top-nav `+ TOOLS`).
  const capabilityCounts: CapabilityCounts = {}
  const capabilitySlot = <CapabilityCardGrid counts={capabilityCounts} />

  const actividadSlot = (
    <TimelineFeed items={actividadItems} max={10} emptyLabel="Sin escalaciones contables." />
  )

  const summaryLine = mveCritical > 0
    ? `${mveCritical} MVE crítico${mveCritical === 1 ? '' : 's'} · ${closeOpen} pendiente${closeOpen === 1 ? '' : 's'} del cierre.`
    : closeOpen > 0
      ? `${closeOpen} pendiente${closeOpen === 1 ? '' : 's'} del cierre mensual.`
      : `${cruzadosMesCount} cruces facturables este mes.`

  return (
    <CockpitInicio
      role="accounting"
      name={opName}
      heroKPIs={heroKPIs}
      navCounts={navCounts}
      estadoSections={estadoSections}
      capabilitySlot={capabilitySlot}
      actividadSlot={actividadSlot}
      systemStatus={mveCritical > 0 || closeOpen > 5 ? 'warning' : 'healthy'}
      pulseSignal={facturasReady.length > 0}
      summaryLine={summaryLine}
    />
  )
}
