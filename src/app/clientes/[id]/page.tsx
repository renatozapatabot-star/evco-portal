import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { fmtDateTime, fmtUSDCompact } from '@/lib/format-utils'
import {
  GREEN, AMBER, RED, TEXT_MUTED, TEXT_PRIMARY,
} from '@/lib/design-system'
import { HeroStrip, type HeroTile } from '@/app/traficos/[id]/_components/HeroStrip'
import { ClienteTabStrip } from './_components/ClienteTabStrip'
import { TraficosTab, type TraficoRow } from './_components/TraficosTab'
import { FraccionesTab, type FraccionRow } from './_components/FraccionesTab'
import { Placeholder } from './_components/Placeholder'
import { ContactoPanel, AlertasPanel } from './_components/SidePanel'
import { PageOpenTracker } from './_components/PageOpenTracker'

interface CompanyRow {
  company_id: string
  name: string | null
  rfc: string | null
  contacto_nombre: string | null
  contacto_email: string | null
  contacto_telefono: string | null
  active: boolean | null
}

interface TraficoDbRow {
  trafico: string
  estatus: string | null
  pedimento: string | null
  importe_total: number | null
  created_at: string | null
  updated_at: string | null
  fecha_llegada: string | null
  company_id: string | null
}

interface PartidaDbRow {
  fraccion: string | null
  fraccion_arancelaria: string | null
  descripcion: string | null
  cve_trafico: string | null
}

interface DecisionDbRow {
  id: number
  decision_type: string
  decision: string
  created_at: string
}

interface ProveedorDbRow {
  nombre: string | null
  rfc: string | null
  cve_proveedor: string | null
}

function statusDot(lastActivityIso: string | null | undefined): { color: string; label: string } {
  if (!lastActivityIso) return { color: TEXT_MUTED, label: 'Sin actividad' }
  const age = Date.now() - new Date(lastActivityIso).getTime()
  const days = age / 86_400_000
  if (days < 2) return { color: GREEN, label: 'Activo' }
  if (days < 14) return { color: AMBER, label: 'Pausado' }
  return { color: RED, label: 'Inactivo' }
}

function startOfYearISO(): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).toISOString()
}

function thirtyDaysAgoISO(): string {
  return new Date(Date.now() - 30 * 86_400_000).toISOString()
}

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = await params
  const clienteId = decodeURIComponent(rawId)

  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const isOperator = session.role === 'operator'
  const isSelf = session.companyId === clienteId

  // Non-internal users can only see their own company. Operators can only
  // see clients they have active work with — enforced via traficos lookup below.
  if (!isInternal && !isOperator && !isSelf) {
    redirect('/')
  }

  const supabase = createServerClient()

  // Operator access gate: verify assignment via traficos.assigned_to_operator_id
  // Operators are identified by companyId (composite user_id format).
  if (isOperator && !isSelf) {
    const { data: assigned } = await supabase
      .from('traficos')
      .select('trafico')
      .eq('company_id', clienteId)
      .eq('assigned_to_operator_id', session.companyId)
      .limit(1)
    if (!assigned || assigned.length === 0) {
      redirect('/')
    }
  }

  const ytdISO = startOfYearISO()
  const thirtyISO = thirtyDaysAgoISO()

  // Fetch companies row — tolerate missing optional columns.
  let company: CompanyRow | null = null
  {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('company_id', clienteId)
      .maybeSingle()
    if (data) {
      const raw = data as Record<string, unknown>
      company = {
        company_id: String(raw.company_id ?? clienteId),
        name: (raw.name as string | null) ?? null,
        rfc: (raw.rfc as string | null) ?? (raw.RFC as string | null) ?? null,
        contacto_nombre: (raw.contacto_nombre as string | null) ?? (raw.contact_name as string | null) ?? null,
        contacto_email: (raw.contacto_email as string | null) ?? (raw.contact_email as string | null) ?? null,
        contacto_telefono: (raw.contacto_telefono as string | null) ?? (raw.contact_phone as string | null) ?? null,
        active: (raw.active as boolean | null) ?? null,
      }
    }
  }
  if (!company) notFound()

  const [
    traficosActiveRes,
    traficosMonthRes,
    traficosYtdRes,
    traficosAllRes,
    partidasRes,
    proveedoresRes,
    decisionsRes,
    approvalsRes,
  ] = await Promise.all([
    supabase.from('traficos').select('trafico', { count: 'exact', head: true })
      .eq('company_id', clienteId).in('estatus', ['En Proceso', 'Documentacion', 'En Aduana']),
    supabase.from('traficos').select('trafico', { count: 'exact', head: true })
      .eq('company_id', clienteId).gte('created_at', thirtyISO),
    supabase.from('traficos')
      .select('trafico, estatus, pedimento, importe_total, created_at, updated_at, fecha_llegada, company_id')
      .eq('company_id', clienteId).gte('created_at', ytdISO).order('created_at', { ascending: false }).limit(500),
    supabase.from('traficos')
      .select('trafico, estatus, pedimento, importe_total, created_at, updated_at, fecha_llegada, company_id')
      .eq('company_id', clienteId).order('updated_at', { ascending: false }).limit(100),
    supabase.from('globalpc_partidas')
      .select('fraccion, fraccion_arancelaria, descripcion, cve_trafico')
      .eq('company_id', clienteId).limit(2000),
    supabase.from('globalpc_proveedores')
      .select('nombre, rfc, cve_proveedor')
      .eq('company_id', clienteId).limit(100),
    supabase.from('operational_decisions')
      .select('id, decision_type, decision, created_at')
      .eq('company_id', clienteId).order('created_at', { ascending: false }).limit(20),
    supabase.from('operational_decisions')
      .select('decision_type, decision', { count: 'exact' })
      .eq('company_id', clienteId).eq('decision_type', 'approval'),
  ])

  const activeCount = traficosActiveRes.count ?? 0
  const monthCount = traficosMonthRes.count ?? 0
  const ytdRows = (traficosYtdRes.data as TraficoDbRow[] | null) ?? []
  const ytdValue = ytdRows.reduce((acc, r) => acc + Number(r.importe_total ?? 0), 0)
  const allTraficos = (traficosAllRes.data as TraficoDbRow[] | null) ?? []
  const partidas = (partidasRes.data as PartidaDbRow[] | null) ?? []
  const proveedores = (proveedoresRes.error ? [] : (proveedoresRes.data as ProveedorDbRow[] | null) ?? [])
  const decisions = (decisionsRes.data as DecisionDbRow[] | null) ?? []

  // Compliance % — approvals / all decisions with decision_type containing "approval"
  // Heuristic: if approvals table empty, show "—".
  let compliancePct: string = '—'
  const approvalsCount = approvalsRes.count ?? 0
  if (decisions.length >= 10) {
    const decided = decisions.length
    const pct = decided > 0 ? Math.round((approvalsCount / Math.max(1, decided)) * 100) : 0
    compliancePct = `${Math.min(100, pct)}%`
  }

  // Fracciones histogram (top 20)
  const fraccionMap = new Map<string, { count: number; descripcion: string | null }>()
  for (const p of partidas) {
    const key = (p.fraccion ?? p.fraccion_arancelaria ?? '').trim()
    if (!key) continue
    const existing = fraccionMap.get(key)
    if (existing) {
      existing.count += 1
      if (!existing.descripcion && p.descripcion) existing.descripcion = p.descripcion
    } else {
      fraccionMap.set(key, { count: 1, descripcion: p.descripcion ?? null })
    }
  }
  const fracciones: FraccionRow[] = Array.from(fraccionMap.entries())
    .map(([fraccion, { count, descripcion }]) => ({ fraccion, count, descripcion }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  const traficoRows: TraficoRow[] = allTraficos.map((r) => ({
    trafico: r.trafico,
    estatus: r.estatus,
    pedimento: r.pedimento,
    importe_total: r.importe_total,
    updated_at: r.updated_at,
    created_at: r.created_at,
  }))

  const lastActivity = allTraficos[0]?.updated_at ?? allTraficos[0]?.created_at ?? null
  const dot = statusDot(lastActivity)

  const heroTiles: HeroTile[] = [
    { label: 'Tráficos activos', value: String(activeCount), mono: true },
    { label: 'Tráficos último mes', value: String(monthCount), mono: true },
    { label: 'Valor YTD', value: ytdValue > 0 ? fmtUSDCompact(ytdValue) : '—', mono: true },
    { label: 'Cumplimiento', value: compliancePct, mono: true, hint: decisions.length < 10 ? 'Datos insuficientes' : null },
  ]

  const proveedoresContent = proveedores.length > 0 ? (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: TEXT_MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <th style={{ padding: '8px 12px' }}>Proveedor</th>
            <th style={{ padding: '8px 12px' }}>RFC</th>
          </tr>
        </thead>
        <tbody>
          {proveedores.slice(0, 50).map((p, i) => (
            <tr key={`${p.cve_proveedor ?? p.rfc ?? 'row'}-${i}`}>
              <td style={{ padding: '8px 12px', color: TEXT_PRIMARY }}>{p.nombre ?? '—'}</td>
              <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: TEXT_MUTED }}>{p.rfc ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : <Placeholder message="Sin proveedores registrados para este cliente." />

  return (
    <div style={{ padding: '8px 0', maxWidth: 1400, margin: '0 auto' }}>
      <PageOpenTracker clienteId={clienteId} />

      <Link
        href="/"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: TEXT_MUTED, textDecoration: 'none',
          marginBottom: 16, minHeight: 60, lineHeight: '60px',
        }}
      >
        <ArrowLeft size={14} /> Inicio
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <span style={{
          width: 12, height: 12, borderRadius: '50%',
          background: dot.color, boxShadow: `0 0 8px ${dot.color}`,
          flexShrink: 0,
        }} />
        <h1 style={{
          fontSize: 32, fontWeight: 800, color: TEXT_PRIMARY,
          margin: 0, letterSpacing: '-0.02em',
        }}>
          {company.name ?? clienteId}
        </h1>
        {company.rfc && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {company.rfc}
          </span>
        )}
        <span style={{
          fontSize: 11, fontWeight: 700, color: dot.color,
          background: 'rgba(255,255,255,0.04)',
          padding: '4px 10px', borderRadius: 999,
        }}>
          {dot.label}
        </span>
        {lastActivity && (
          <span style={{
            marginLeft: 'auto',
            fontSize: 11, fontFamily: 'var(--font-mono)', color: TEXT_MUTED,
          }}>
            Últ. actividad: {fmtDateTime(lastActivity)}
          </span>
        )}
      </div>

      <HeroStrip tiles={heroTiles} />

      <div
        className="cliente-main-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <ClienteTabStrip
            clienteId={clienteId}
            tabs={[
              { id: 'traficos', label: 'Tráficos', content: <TraficosTab rows={traficoRows} /> },
              { id: 'proveedores', label: 'Proveedores', content: proveedoresContent },
              { id: 'fracciones', label: 'Fracciones usadas', content: <FraccionesTab rows={fracciones} /> },
              { id: 'cumplimiento', label: 'Cumplimiento', content: <Placeholder message={decisions.length < 10 ? 'Datos insuficientes para calcular cumplimiento.' : 'Disponible próximamente.'} /> },
              { id: 'finanzas', label: 'Finanzas', content: <Placeholder message="Disponible próximamente." /> },
            ]}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ContactoPanel info={{
            nombre: company.contacto_nombre,
            email: company.contacto_email,
            telefono: company.contacto_telefono,
            rfc: company.rfc,
          }} />
          <AlertasPanel rows={decisions} />
        </div>
      </div>

      <div style={{
        textAlign: 'center', padding: '20px 0',
        fontSize: 11, color: TEXT_MUTED,
      }}>
        Renato Zapata &amp; Company · Patente 3596 · Aduana 240
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .cliente-main-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

