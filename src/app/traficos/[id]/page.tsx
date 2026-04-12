import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { fmtDateTime, fmtPedimentoShort, fmtUSD } from '@/lib/format-utils'
import {
  ACCENT_CYAN,
  GREEN,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '@/lib/design-system'
import { HeroStrip, type HeroTile } from './_components/HeroStrip'
import { TabStrip } from './_components/TabStrip'
import { DocumentosTab } from './_components/DocumentosTab'
import { PartidasTab } from './_components/PartidasTab'
import { CronologiaTab } from './_components/CronologiaTab'
import { NotasTab } from './_components/NotasTab'
import { ComunicacionTab } from './_components/ComunicacionTab'
import { AccionesRapidasPanel } from './_components/AccionesRapidasPanel'
import { InfoLateralPanel } from './_components/InfoLateralPanel'
import { PageOpenTracker } from './_components/PageOpenTracker'

// ── Row types (kept local — this page is a thin data → props adapter) ──

interface TraficoRow {
  trafico: string
  estatus: string | null
  pedimento: string | null
  fecha_llegada: string | null
  importe_total: number | null
  regimen: string | null
  company_id: string | null
  proveedores: string | null
  descripcion_mercancia: string | null
  updated_at?: string | null
  created_at?: string | null
}

interface DocRow {
  id: string
  document_type: string | null
  doc_type: string | null
  file_name: string | null
  created_at: string | null
}

interface PartidaRow {
  id: number
  numero_parte: string | null
  descripcion: string | null
  fraccion_arancelaria: string | null
  fraccion: string | null
  cantidad: number | null
  cantidad_bultos: number | null
  peso_bruto: number | null
  valor_comercial: number | null
  regimen: string | null
}

interface DecisionRow {
  id: number
  decision_type: string
  decision: string
  reasoning: string | null
  created_at: string
}

interface NoteRow {
  id: string
  author_id: string
  content: string
  mentions: string[]
  created_at: string
}

interface CompanyRow {
  company_id: string
  name: string | null
}

// ── Helpers ──────────────────────────────────────────────────

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000))
}

function pillColor(status: string | null): { bg: string; fg: string; label: string } {
  const s = (status ?? '').toLowerCase()
  if (s.includes('cruz')) return { bg: 'rgba(34,197,94,0.12)', fg: GREEN, label: status ?? '' }
  if (s.includes('pagado')) return { bg: 'rgba(34,197,94,0.12)', fg: GREEN, label: status ?? '' }
  return { bg: 'rgba(0,229,255,0.12)', fg: ACCENT_CYAN, label: status ?? 'Sin estatus' }
}

// ── Page ────────────────────────────────────────────────────

export default async function TraficoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = await params
  const traficoId = decodeURIComponent(rawId)

  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const supabase = createServerClient()

  let traficoQ = supabase
    .from('traficos')
    .select('trafico, estatus, pedimento, fecha_llegada, importe_total, regimen, company_id, proveedores, descripcion_mercancia, updated_at, created_at')
    .eq('trafico', traficoId)
  if (!isInternal) traficoQ = traficoQ.eq('company_id', session.companyId)

  const [traficoRes, docsRes, partidasRes, decisionsRes, notesRes] = await Promise.all([
    traficoQ.maybeSingle(),
    supabase
      .from('expediente_documentos')
      .select('id, document_type, doc_type, file_name, created_at')
      .eq('trafico_id', traficoId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('globalpc_partidas')
      .select('id, numero_parte, descripcion, fraccion_arancelaria, fraccion, cantidad, cantidad_bultos, peso_bruto, valor_comercial, regimen')
      .eq('cve_trafico', traficoId)
      .limit(500),
    supabase
      .from('operational_decisions')
      .select('id, decision_type, decision, reasoning, created_at')
      .eq('trafico', traficoId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('trafico_notes')
      .select('id, author_id, content, mentions, created_at')
      .eq('trafico_id', traficoId)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const trafico = traficoRes.data as TraficoRow | null
  if (!trafico) notFound()

  const docs = ((docsRes.data as DocRow[] | null) ?? [])
  const partidas = ((partidasRes.data as PartidaRow[] | null) ?? [])
  const decisions = ((decisionsRes.data as DecisionRow[] | null) ?? [])
  const notes = ((notesRes.data as NoteRow[] | null) ?? [])

  // Company name — single lookup, tolerate failures.
  let companyName: string | null = null
  if (trafico.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('company_id, name')
      .eq('company_id', trafico.company_id)
      .maybeSingle()
    companyName = (company as CompanyRow | null)?.name ?? null
  }

  const status = trafico.estatus ?? ''
  const pill = pillColor(status)
  const days = daysSince(trafico.created_at ?? trafico.fecha_llegada)
  const valor = Number(trafico.importe_total ?? 0)

  const heroTiles: HeroTile[] = [
    { label: 'Estatus', value: pill.label || '—' },
    { label: 'Días activos', value: days != null ? String(days) : '—', mono: true },
    { label: 'Documentos', value: String(docs.length), mono: true, hint: `${partidas.length} partidas` },
    { label: 'Valor declarado', value: valor > 0 ? `${fmtUSD(valor)} USD` : '—', mono: true },
  ]

  const lastUpdate = trafico.updated_at ?? trafico.created_at ?? null

  const infoRows = [
    { label: 'Cliente', value: companyName ?? (trafico.company_id ?? '—') },
    { label: 'Proveedor', value: (trafico.proveedores?.split(',')[0] || '').trim() || '—' },
    { label: 'Régimen', value: trafico.regimen ?? 'A1' },
    {
      label: 'Pedimento',
      value: trafico.pedimento ? fmtPedimentoShort(trafico.pedimento) : 'Pendiente',
      mono: true,
    },
    { label: 'Operador asignado', value: isInternal ? `${session.companyId}:${session.role}` : '—', mono: true },
  ]

  return (
    <div style={{ padding: '8px 0', maxWidth: 1400, margin: '0 auto' }}>
      <PageOpenTracker traficoId={traficoId} />

      {/* Back nav */}
      <Link
        href="/traficos"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: TEXT_MUTED,
          textDecoration: 'none',
          marginBottom: 16,
          minHeight: 60,
          lineHeight: '60px',
        }}
      >
        <ArrowLeft size={14} /> Tráficos
      </Link>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 32,
            fontWeight: 800,
            color: TEXT_PRIMARY,
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          {trafico.trafico}
        </h1>
        {companyName && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: ACCENT_CYAN,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '4px 10px',
              background: 'rgba(0,229,255,0.12)',
              border: `1px solid rgba(0,229,255,0.24)`,
              borderRadius: 999,
            }}
          >
            {companyName}
          </span>
        )}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: pill.fg,
            background: pill.bg,
            padding: '4px 10px',
            borderRadius: 999,
          }}
        >
          {pill.label}
        </span>
        {lastUpdate && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: TEXT_MUTED,
            }}
          >
            Últ. actualización: {fmtDateTime(lastUpdate)}
          </span>
        )}
      </div>

      <HeroStrip tiles={heroTiles} />

      {/* 2-col grid */}
      <div
        className="trafico-main-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <TabStrip
            traficoId={traficoId}
            tabs={[
              { id: 'documentos', label: 'Documentos', content: <DocumentosTab docs={docs} /> },
              { id: 'partidas', label: 'Partidas', content: <PartidasTab partidas={partidas} /> },
              { id: 'cronologia', label: 'Cronología', content: <CronologiaTab decisions={decisions} /> },
              { id: 'notas', label: 'Notas', content: <NotasTab traficoId={traficoId} notes={notes} /> },
              { id: 'comunicacion', label: 'Comunicación', content: <ComunicacionTab /> },
            ]}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AccionesRapidasPanel
            traficoId={traficoId}
            currentStatus={status}
            canEdit={isInternal}
          />
          <InfoLateralPanel rows={infoRows} />
        </div>
      </div>

      <div
        style={{
          textAlign: 'center',
          padding: '20px 0',
          fontSize: 11,
          color: TEXT_MUTED,
        }}
      >
        Renato Zapata &amp; Company · Patente 3596 · Aduana 240
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .trafico-main-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

    </div>
  )
}
