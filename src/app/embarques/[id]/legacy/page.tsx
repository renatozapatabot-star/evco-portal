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
import { getRequiredDocs, type DocType } from '@/lib/doc-requirements'
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
  document_type_confidence: number | null
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
  return { bg: 'rgba(192,197,206,0.12)', fg: ACCENT_CYAN, label: status ?? 'Sin estatus' }
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

  const [traficoRes, docsRes, facturasRes, decisionsRes, notesRes] = await Promise.all([
    traficoQ.maybeSingle(),
    supabase
      .from('expediente_documentos')
      .select('id, document_type, document_type_confidence, doc_type, file_name, created_at')
      .eq('trafico_id', traficoId)
      .order('created_at', { ascending: false })
      .limit(200),
    // Step 1 of partidas chain: folios for this embarque from globalpc_facturas.
    // (globalpc_partidas has no cve_trafico column — must hop via folio.)
    supabase
      .from('globalpc_facturas')
      .select('folio')
      .eq('cve_trafico', traficoId)
      .limit(100),
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
  const decisions = ((decisionsRes.data as DecisionRow[] | null) ?? [])
  const notes = ((notesRes.data as NoteRow[] | null) ?? [])

  // Step 2 of partidas chain: real columns from globalpc_partidas, then enrich
  // descripcion + fraccion via globalpc_productos.
  const folios = ((facturasRes.data as Array<{ folio: number | null }> | null) ?? [])
    .map(f => f.folio)
    .filter((f): f is number => f != null)

  let partidas: PartidaRow[] = []
  if (folios.length > 0) {
    const { data: rawPartidas } = await supabase
      .from('globalpc_partidas')
      .select('id, folio, cve_producto, cve_cliente, cantidad, precio_unitario, peso, pais_origen')
      .in('folio', folios)
      .limit(500)
    const partidaRows = (rawPartidas ?? []) as Array<{
      id: number
      folio: number | null
      cve_producto: string | null
      cve_cliente: string | null
      cantidad: number | null
      precio_unitario: number | null
      peso: number | null
      pais_origen: string | null
    }>
    const cves = Array.from(new Set(partidaRows.map(p => p.cve_producto).filter((c): c is string => !!c)))
    const productMap = new Map<string, { descripcion: string | null; fraccion: string | null }>()
    if (cves.length > 0) {
      const { data: prods } = await supabase
        .from('globalpc_productos')
        .select('cve_producto, cve_cliente, descripcion, fraccion')
        .in('cve_producto', cves)
        .limit(2000)
      for (const p of (prods ?? []) as Array<{
        cve_producto: string | null
        cve_cliente: string | null
        descripcion: string | null
        fraccion: string | null
      }>) {
        productMap.set(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`, {
          descripcion: p.descripcion,
          fraccion: p.fraccion,
        })
      }
    }
    partidas = partidaRows.map((p, i): PartidaRow => {
      const enr = productMap.get(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`)
      const cantidad = Number(p.cantidad) || 0
      const precio = Number(p.precio_unitario) || 0
      return {
        id: Number(p.id ?? i),
        numero_parte: p.cve_producto,
        descripcion: enr?.descripcion ?? null,
        fraccion_arancelaria: enr?.fraccion ?? null,
        fraccion: enr?.fraccion ?? null,
        cantidad,
        cantidad_bultos: null,
        peso_bruto: p.peso ?? null,
        valor_comercial: cantidad * precio,
        regimen: null,
      }
    })
  }

  // Block 7 — best-effort users fetch for mention autocomplete.
  // No `users` table exists yet; if/when it lands, this query starts
  // returning rows. For now we gracefully fall back to [] and the
  // autocomplete simply never opens (plaintext @text still works).
  interface UserRow { id: string; full_name: string | null; role: string | null }
  let availableUsers: { id: string; label: string }[] = []
  try {
    const { data: userRows, error: userErr } = await supabase
      .from('users')
      .select('id, full_name, role')
      .in('role', ['operator', 'admin', 'broker'])
      .limit(100)
    if (!userErr && Array.isArray(userRows)) {
      availableUsers = (userRows as UserRow[]).map((u) => ({
        id: u.id,
        label: u.full_name ? `${u.full_name} (${u.role ?? '—'})` : (u.role ?? u.id),
      }))
    }
  } catch (e) {
    // Table doesn't exist; ignore and keep the empty fallback.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[trafico-detail] users table unavailable — mention autocomplete disabled', e)
    }
  }

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

  // Block 5 — derive missing doc types server-side so the Acciones
  // rápidas panel can open the composer with the correct pre-check list.
  const requiredDocs = getRequiredDocs(trafico.regimen)
  const uploadedDocTypes = new Set(
    docs.map((d) => (d.document_type ?? d.doc_type ?? '') as string).filter(Boolean),
  )
  const missingDocs: DocType[] = requiredDocs.filter((d) => !uploadedDocTypes.has(d))

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
        href="/embarques"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 'var(--aguila-fs-body)',
          color: TEXT_MUTED,
          textDecoration: 'none',
          marginBottom: 16,
          minHeight: 60,
          lineHeight: '60px',
        }}
      >
        <ArrowLeft size={14} /> Embarques
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
            fontSize: 'var(--aguila-fs-kpi-compact)',
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
              fontSize: 'var(--aguila-fs-meta)',
              fontWeight: 700,
              color: ACCENT_CYAN,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '4px 10px',
              background: 'rgba(192,197,206,0.12)',
              border: `1px solid rgba(192,197,206,0.24)`,
              borderRadius: 999,
            }}
          >
            {companyName}
          </span>
        )}
        <span
          style={{
            fontSize: 'var(--aguila-fs-meta)',
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
              fontSize: 'var(--aguila-fs-meta)',
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
              { id: 'documentos', label: 'Documentos', content: <DocumentosTab docs={docs} traficoId={traficoId} regimen={trafico.regimen} /> },
              { id: 'partidas', label: 'Partidas', content: <PartidasTab partidas={partidas} /> },
              { id: 'cronologia', label: 'Cronología', content: <CronologiaTab decisions={decisions} /> },
              { id: 'notas', label: 'Notas', content: <NotasTab traficoId={traficoId} notes={notes} /> },
              {
                id: 'comunicacion',
                label: 'Comunicación',
                content: (
                  <ComunicacionTab
                    traficoId={traficoId}
                    notes={notes}
                    currentUserId={`${session.companyId}:${session.role}`}
                    availableUsers={availableUsers}
                  />
                ),
              },
            ]}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AccionesRapidasPanel
            traficoId={traficoId}
            currentStatus={status}
            canEdit={isInternal}
            cliente={companyName ?? (trafico.company_id ?? '—')}
            proveedor={(trafico.proveedores?.split(',')[0] || '').trim() || null}
            missingDocs={missingDocs}
            operatorName={`${session.companyId}:${session.role}`}
          />
          <InfoLateralPanel rows={infoRows} />
        </div>
      </div>

      <div
        style={{
          textAlign: 'center',
          padding: '20px 0',
          fontSize: 'var(--aguila-fs-meta)',
          color: TEXT_MUTED,
        }}
      >
        Renato Zapata &amp; Company · Patente 3596 · Aduana 240
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .trafico-main-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .trafico-main-grid { gap: 12px !important; }
          .trafico-main-grid h1 { font-size: 24px !important; }
        }
      `}</style>

    </div>
  )
}
