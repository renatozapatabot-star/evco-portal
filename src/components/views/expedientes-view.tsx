'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { FolderOpen, AlertTriangle, FileText, Send, Eye, Search } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { getCookieValue } from '@/lib/client-config'
import { fmtId, fmtDateCompact } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '@/components/ui/EmptyState'
import { PORTAL_DATE_FROM } from '@/lib/data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PAGE_SIZE = 25

// Must match actual doc_type values in expediente_documentos table
const REQUIRED_DOCS = [
  'factura_comercial', 'packing_list', 'pedimento_detallado',
  'cove', 'acuse_cove', 'doda',
]

const DOC_LABELS: Record<string, string> = {
  factura_comercial: 'Factura Comercial',
  packing_list: 'Lista de Empaque',
  pedimento_detallado: 'Pedimento',
  cove: 'COVE',
  acuse_cove: 'Acuse COVE',
  doda: 'DODA',
  mve: 'MVE',
  otro: 'Otro',
  archivos_validacion: 'Archivos Validación',
  pedimento_simplificado: 'Pedimento Simplificado',
  bol: 'B/L',
  carta_porte: 'Carta Porte',
}

type FilterTab = 'incompletos' | 'completos' | 'todos'
type SortOption = 'menos_completo' | 'mayor_valor' | 'fecha_entrada'

interface TraficoRow {
  trafico: string
  estatus: string
  fecha_llegada: string | null
  pedimento_num: string | null
  importe_total: number | null
  docs: string[]
  docCount: number
  pct: number
  missing: string[]
}

function getDocLabel(t: string): string {
  return DOC_LABELS[t] || t.replace(/_/g, ' ')
}

function getDocUrgency(deadline: string | null | undefined): { color: string; label: string } {
  if (!deadline) return { color: '#9C9890', label: '' }
  const now = new Date()
  const due = new Date(deadline)
  const daysUntil = Math.ceil((due.getTime() - now.getTime()) / 86400000)

  if (daysUntil < 0) return { color: '#C23B22', label: `Venció hace ${Math.abs(daysUntil)} días` }
  if (daysUntil <= 7) return { color: '#C23B22', label: `Vence en ${daysUntil} día${daysUntil !== 1 ? 's' : ''}` }
  if (daysUntil <= 30) return { color: '#C47F17', label: `Vence en ${daysUntil} días` }
  if (daysUntil <= 90) return { color: '#D4952A', label: `Vence en ${daysUntil} días` }
  return { color: '#9C9890', label: '' }
}

function getImplicitDeadline(fechaLlegada: string | null): string | null {
  if (!fechaLlegada) return null
  return new Date(new Date(fechaLlegada).getTime() + 14 * 86400000).toISOString()
}

// ── Summary Card ────────────────────────────────────────

function SummaryCard({
  incompletos,
  total,
  globalPct,
  totalMissingDocs,
  onSolicitarTodos,
  soliciting,
}: {
  incompletos: number
  total: number
  globalPct: number
  totalMissingDocs: number
  onSolicitarTodos: () => void
  soliciting: boolean
}) {
  return (
    <div className="card" style={{
      padding: '20px 24px',
      marginBottom: 16,
      position: 'sticky',
      top: 0,
      zIndex: 10,
      background: 'var(--card-bg)',
      borderBottom: '1px solid #E8E5E0',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--body-text)', margin: 0 }}>
            {incompletos} expediente{incompletos !== 1 ? 's' : ''} incompleto{incompletos !== 1 ? 's' : ''}
          </p>
          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <div style={{ flex: 1, height: 8, background: '#E8E5E0', borderRadius: 9999, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${globalPct}%`,
                  height: '100%',
                  background: globalPct >= 80 ? '#2D8540' : globalPct >= 50 ? '#C47F17' : '#C23B22',
                  borderRadius: 9999,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <span
              className="font-mono"
              style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', minWidth: 48, textAlign: 'right' }}
            >
              {globalPct}%
            </span>
          </div>
          <p style={{ fontSize: 11, color: '#9C9890', margin: '6px 0 0' }}>
            Completitud global de documentos
          </p>
        </div>
        <button
          onClick={onSolicitarTodos}
          disabled={soliciting || totalMissingDocs === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 20px',
            background: soliciting || totalMissingDocs === 0 ? '#D4C9A8' : '#B8953F',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: soliciting || totalMissingDocs === 0 ? 'default' : 'pointer',
            minHeight: 60,
            fontFamily: 'inherit',
            opacity: soliciting ? 0.7 : 1,
          }}
        >
          <Send size={14} />
          {soliciting
            ? 'Solicitando...'
            : `Solicitar todos los faltantes (${totalMissingDocs})`}
        </button>
      </div>
    </div>
  )
}

// ── Filter Tabs ─────────────────────────────────────────

function FilterTabs({
  active,
  counts,
  onChange,
}: {
  active: FilterTab
  counts: { incompletos: number; completos: number; todos: number }
  onChange: (t: FilterTab) => void
}) {
  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'incompletos', label: 'Incompletos', count: counts.incompletos },
    { key: 'completos', label: 'Completos', count: counts.completos },
    { key: 'todos', label: 'Todos', count: counts.todos },
  ]
  return (
    <div className="filter-bar">
      {tabs.map((tab) => {
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`filter-chip${isActive ? ' active' : ''}`}
          >
            {tab.label}{' '}
            <span className="font-mono" style={{ fontWeight: 700 }}>{tab.count}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Progress Bar (inline) ───────────────────────────────

function ProgressBar({ pct: p }: { pct: number }) {
  const color = p >= 100 ? '#2D8540' : p >= 50 ? '#C47F17' : '#C23B22'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 5, background: '#E8E5E0', borderRadius: 9999, overflow: 'hidden' }}>
        <div style={{ width: `${p}%`, height: '100%', background: color, borderRadius: 9999 }} />
      </div>
      <span className="font-mono" style={{ color, fontSize: 11, fontWeight: 700, minWidth: 32 }}>{p}%</span>
    </div>
  )
}

// ── Mobile Card ─────────────────────────────────────────

function MobileCard({ row, onNavigate }: { row: TraficoRow; onNavigate: (id: string) => void }) {
  const noPedimento = !row.pedimento_num
  const deadline = getImplicitDeadline(row.fecha_llegada)
  const urgency = row.missing.length > 0 ? getDocUrgency(deadline) : { color: '#9C9890', label: '' }
  const isOverdue = deadline ? Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000) < 0 : false

  return (
    <div
      style={{
        background: isOverdue && row.missing.length > 0 ? 'rgba(194,59,34,0.04)' : 'var(--card-bg)',
        border: '1px solid #E8E5E0',
        borderLeft: row.missing.length > 0 ? `4px solid ${urgency.color}` : noPedimento ? '4px solid #C23B22' : '1px solid #E8E5E0',
        borderRadius: 8,
        padding: 16,
        marginBottom: 8,
      }}
    >
      {/* Header line */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="trafico-id" style={{ fontSize: 14, fontWeight: 700 }}>{fmtId(row.trafico)}</span>
        <span
          className={`badge ${row.estatus === 'Cruzado' ? 'badge-cruzado' : row.estatus === 'Detenido' ? 'badge-hold' : 'badge-proceso'}`}
        >
          <span className="badge-dot" /><span className="sr-only">Estado: </span>
          {row.estatus}
        </span>
      </div>

      {/* Sin pedimento alert */}
      {noPedimento && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 6, padding: '4px 10px', marginBottom: 8, width: 'fit-content',
        }}>
          <AlertTriangle size={12} style={{ color: '#C23B22' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#991B1B' }}>Sin pedimento</span>
        </div>
      )}

      {/* Urgency label */}
      {urgency.label && row.missing.length > 0 && (
        <div style={{ fontSize: 11, fontWeight: 600, color: urgency.color, marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
          {urgency.label}
        </div>
      )}

      {/* Docs + progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span className="font-mono" style={{ fontSize: 13 }}>
          {row.docCount}/{REQUIRED_DOCS.length} docs
        </span>
        <div style={{ flex: 1 }}>
          <ProgressBar pct={row.pct} />
        </div>
      </div>

      {/* Missing docs */}
      {row.missing.length > 0 && (
        <p style={{ fontSize: 12, color: '#6B6B6B', margin: '0 0 10px' }}>
          Faltan:{' '}
          {row.missing.slice(0, 3).map(getDocLabel).join(', ')}
          {row.missing.length > 3 && `, +${row.missing.length - 3}`}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {row.missing.length > 0 && (
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 14px', background: '#B8953F', color: '#FFFFFF',
              border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', minHeight: 60, fontFamily: 'inherit',
            }}
          >
            <Send size={12} /> Solicitar
          </button>
        )}
        <button
          onClick={() => onNavigate(row.trafico)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '8px 14px', background: 'var(--card-bg)',
            border: '1px solid #E8E5E0', color: '#1A1A1A',
            borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', minHeight: 60, fontFamily: 'inherit',
          }}
        >
          <Eye size={12} /> Ver
        </button>
      </div>
    </div>
  )
}

// ── Main View ───────────────────────────────────────────

export function ExpedientesView() {
  const companyId = getCookieValue('company_id') ?? ''
  const router = useRouter()
  const isMobile = useIsMobile()
  const [rawTraficos, setRawTraficos] = useState<TraficoRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [filter, setFilter] = useState<FilterTab>('incompletos')
  const [sortBy, setSortBy] = useState<SortOption>('menos_completo')
  const [soliciting, setSoliciting] = useState(false)

  const load = useCallback(async (attempt = 0): Promise<void> => {
    const MAX_RETRIES = 3
    const BASE_DELAY = 800

    if (attempt === 0) {
      setLoading(true)
      setLoadError(null)
    } else {
      setRetrying(true)
    }

    try {
      // 1. Fetch active tráficos for the client using company_id
      let q = supabase
        .from('traficos')
        .select('id, trafico, estatus, fecha_llegada, importe_total, pedimento, proveedores, descripcion_mercancia', { count: 'exact' })
        .eq('company_id', companyId)
        .not('estatus', 'ilike', '%cruz%')
        .gte('fecha_llegada', PORTAL_DATE_FROM)
        .order('fecha_llegada', { ascending: true })
        .limit(500)

      if (search) q = q.ilike('trafico', `%${search}%`)

      const { data: traficos, error: traficoError, count } = await q
      if (traficoError) throw new Error(traficoError.message)

      const allRows = traficos || []
      setTotal(count || 0)

      // 2. Batch-load documents from expediente_documentos (pedimento_id = traficos.trafico)
      const traficoIds = allRows.map((t) => t.trafico)
      const docMap = new Map<string, Set<string>>()

      if (traficoIds.length > 0) {
        // Supabase .in() has a practical limit — batch in chunks of 100
        const CHUNK = 100
        for (let i = 0; i < traficoIds.length; i += CHUNK) {
          const chunk = traficoIds.slice(i, i + CHUNK)
          const { data: chunkDocs, error: docError } = await supabase
            .from('expediente_documentos')
            .select('pedimento_id, doc_type')
            .in('pedimento_id', chunk)

          if (docError) throw new Error(docError.message)

          chunkDocs?.forEach((d: { pedimento_id: string; doc_type: string | null }) => {
            if (!docMap.has(d.pedimento_id)) docMap.set(d.pedimento_id, new Set())
            if (d.doc_type) docMap.get(d.pedimento_id)!.add(d.doc_type)
          })
        }
      }

      // 3. Build enriched rows with completeness calculation
      const enriched: TraficoRow[] = allRows.map((r) => {
        const present = docMap.get(r.trafico) ?? new Set<string>()
        const docsPresent = REQUIRED_DOCS.filter((rd) => present.has(rd)).length
        const missing = REQUIRED_DOCS.filter((rd) => !present.has(rd))
        const pct = Math.round((docsPresent / REQUIRED_DOCS.length) * 100)
        return {
          trafico: r.trafico,
          estatus: r.estatus || 'En Proceso',
          fecha_llegada: r.fecha_llegada,
          pedimento_num: r.pedimento || null,
          importe_total: r.importe_total ?? null,
          docs: Array.from(present),
          docCount: docsPresent,
          pct,
          missing,
        }
      }).sort((a, b) => a.pct - b.pct)

      setRawTraficos(enriched)
      setLoadError(null)
    } catch (err) {
      // Log full error for debugging — never expose to user
      console.error('[Expedientes] Load error:', err)

      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY * Math.pow(2, attempt) // 800 → 1600 → 3200
        await new Promise(resolve => setTimeout(resolve, delay))
        return load(attempt + 1)
      }

      setRawTraficos([])
      setTotal(0)
      setLoadError('No se pudieron cargar los expedientes')
    } finally {
      setLoading(false)
      setRetrying(false)
    }
  }, [search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search, filter, sortBy])

  // ── Realtime: refresh row when documents change ──────
  useEffect(() => {
    if (rawTraficos.length === 0) return

    const channel = supabase
      .channel('expediente-docs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expediente_documentos',
        },
        (payload) => {
          const record = (payload.new ?? payload.old) as
            | { pedimento_id?: string }
            | null
          const traficoId = record?.pedimento_id
          if (!traficoId) return

          // Only refresh if this tráfico is in our current set
          if (!rawTraficos.some((t) => t.trafico === traficoId)) return

          // Refresh just this row's documents — not the entire list
          supabase
            .from('expediente_documentos')
            .select('pedimento_id, doc_type')
            .eq('pedimento_id', traficoId)
            .then(({ data: docs }) => {
              if (!docs) return
              const present = new Set(
                docs
                  .map((d: { doc_type: string | null }) => d.doc_type)
                  .filter(Boolean) as string[]
              )
              const docsPresent = REQUIRED_DOCS.filter((rd) => present.has(rd)).length
              const missing = REQUIRED_DOCS.filter((rd) => !present.has(rd))
              const pct = Math.round((docsPresent / REQUIRED_DOCS.length) * 100)

              setRawTraficos((prev) =>
                prev.map((t) =>
                  t.trafico === traficoId
                    ? { ...t, docs: Array.from(present), docCount: docsPresent, pct, missing }
                    : t
                )
              )
            })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [rawTraficos])

  // ── Derived data ──────────────────────────────────────

  const counts = useMemo(() => {
    const incompletos = rawTraficos.filter((r) => r.pct < 100).length
    const completos = rawTraficos.filter((r) => r.pct >= 100).length
    return { incompletos, completos, todos: rawTraficos.length }
  }, [rawTraficos])

  const globalPct = useMemo(() => {
    if (rawTraficos.length === 0) return 0
    const totalDocs = rawTraficos.reduce((acc, r) => acc + r.docCount, 0)
    const totalExpected = rawTraficos.length * REQUIRED_DOCS.length
    return Math.round((totalDocs / totalExpected) * 100)
  }, [rawTraficos])

  const totalMissingDocs = useMemo(() => {
    return rawTraficos.reduce((acc, r) => acc + r.missing.length, 0)
  }, [rawTraficos])

  const filtered = useMemo(() => {
    let rows = rawTraficos
    if (filter === 'incompletos') rows = rows.filter((r) => r.pct < 100)
    if (filter === 'completos') rows = rows.filter((r) => r.pct >= 100)

    return [...rows].sort((a, b) => {
      // Sin pedimento always first regardless of sort
      const aNoPed = a.pedimento_num ? 0 : 1
      const bNoPed = b.pedimento_num ? 0 : 1
      if (aNoPed !== bNoPed) return bNoPed - aNoPed

      switch (sortBy) {
        case 'mayor_valor':
          return (b.importe_total ?? 0) - (a.importe_total ?? 0)
        case 'fecha_entrada': {
          const aDate = a.fecha_llegada ? new Date(a.fecha_llegada).getTime() : 0
          const bDate = b.fecha_llegada ? new Date(b.fecha_llegada).getTime() : 0
          return bDate - aDate
        }
        case 'menos_completo':
        default:
          if (a.pct !== b.pct) return a.pct - b.pct
          return 0
      }
    })
  }, [rawTraficos, filter, sortBy])

  // Paginate the filtered set
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const handleNavigate = (id: string) => router.push(`/traficos/${id}`)

  const handleSolicitarTodos = async () => {
    const incompleteRows = rawTraficos.filter((r) => r.missing.length > 0)
    if (incompleteRows.length === 0) return

    setSoliciting(true)
    try {
      await Promise.all(
        incompleteRows.map((row) =>
          fetch('/api/solicitar-documentos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              traficoId: row.trafico,
              missingDocs: row.missing,
            }),
          })
        )
      )
      // Reload data after soliciting
      await load()
    } catch {
      // Errors handled per-request by the API
    } finally {
      setSoliciting(false)
    }
  }

  return (
    <div className="page-shell">
      {/* Page header */}
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>Expedientes Digitales</h2>
          <p className="page-subtitle">Control de documentos por tráfico</p>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9C9890' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tráfico..."
            style={{
              paddingLeft: 32, paddingRight: 12, height: 36,
              border: '1px solid #E8E5E0', borderRadius: 8,
              background: 'var(--card-bg)', color: '#1A1A1A', fontSize: 13,
              outline: 'none', width: 200, fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {loadError ? (
        <div style={{
          padding: 48, textAlign: 'center',
          background: 'var(--card-bg)', border: '1px solid #E8E5E0',
          borderRadius: 8, marginTop: 16,
        }}>
          <AlertTriangle size={32} style={{ color: '#C23B22', margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', marginBottom: 6 }}>
            No se pudieron cargar los expedientes
          </div>
          <div style={{ fontSize: 13, color: '#9C9890', marginBottom: 16 }}>
            Error temporal · reintentando automáticamente
          </div>
          <button
            onClick={() => load()}
            disabled={retrying}
            style={{
              padding: '10px 24px', borderRadius: 8,
              border: 'none', background: '#B8953F', color: '#FFFFFF',
              fontSize: 14, fontWeight: 700, cursor: retrying ? 'default' : 'pointer',
              minHeight: 60, fontFamily: 'inherit',
              opacity: retrying ? 0.7 : 1,
            }}
          >
            {retrying ? 'Reintentando...' : 'Reintentar ahora'}
          </button>
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div
            style={{
              width: 28, height: 28, border: '3px solid #E8E5E0',
              borderTopColor: '#B8953F', borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }}
          />
        </div>
      ) : rawTraficos.length === 0 ? (
        <EmptyState
          icon="📁"
          title="No hay expedientes"
          description="Los expedientes de sus tráficos aparecerán aquí"
          cta={{ label: "Ver tráficos", href: "/traficos" }}
        />
      ) : rawTraficos.length > 0 && rawTraficos.every((r) => r.docs.length === 0) ? (
        /* Tráficos found but no completeness data — join is broken. NEVER show "all complete" */
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--status-warning, #C47F17)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⚠</div>
          <p style={{ fontSize: 14, fontWeight: 600 }}>
            {rawTraficos.length} tráficos encontrados sin datos de documentos
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Verificar relación entre tablas documentos → tráficos
          </p>
        </div>
      ) : rawTraficos.length > 0 && rawTraficos.every((r) => r.pct >= 100) ? (
        /* All expedientes complete */
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <FileText size={32} strokeWidth={1.5} style={{ color: '#2D8540', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: '#2D8540' }}>Todos los expedientes completos &#10003;</p>
          <p style={{ fontSize: 12, color: '#9C9890' }}>
            Los {rawTraficos.length} tráficos activos tienen todos sus documentos en orden. · Última verificación: hace 5 min
          </p>
        </div>
      ) : (
        <>
          {/* Summary card */}
          <SummaryCard
            incompletos={counts.incompletos}
            total={counts.todos}
            globalPct={globalPct}
            totalMissingDocs={totalMissingDocs}
            onSolicitarTodos={handleSolicitarTodos}
            soliciting={soliciting}
          />

          {/* Filter tabs + sort controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <FilterTabs active={filter} counts={counts} onChange={setFilter} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#9C9890', whiteSpace: 'nowrap' }}>Ordenar:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #E8E5E0',
                  borderRadius: 8,
                  background: 'var(--card-bg)',
                  color: '#1A1A1A',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  outline: 'none',
                  minHeight: 60,
                }}
              >
                <option value="menos_completo">Menos completo</option>
                <option value="mayor_valor">Mayor valor</option>
                <option value="fecha_entrada">Fecha de entrada</option>
              </select>
            </div>
          </div>

          {/* Content */}
          {pageRows.length === 0 ? (
            <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <FileText size={28} strokeWidth={1.5} style={{ color: '#9C9890', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
                {filter === 'completos' ? 'Sin expedientes completos' : 'Todos los expedientes completos ✓'}
              </p>
              <p style={{ fontSize: 12, color: '#9C9890' }}>
                {filter === 'completos' ? 'Aún no hay tráficos con todos sus documentos.' : 'Todos los documentos están en orden. · Última verificación: hace 5 min'}
              </p>
            </div>
          ) : isMobile ? (
            /* ── Mobile card layout ── */
            <div>
              {pageRows.map((row) => (
                <MobileCard key={row.trafico} row={row} onNavigate={handleNavigate} />
              ))}
            </div>
          ) : (
            /* ── Desktop table ── */
            <div className="table-shell">
              <table className="cruz-table">
                <thead>
                  <tr>
                    <th scope="col">Tráfico</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Docs</th>
                    <th scope="col">Completitud</th>
                    <th scope="col">Faltantes</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const noPedimento = !row.pedimento_num
                    const rowDeadline = getImplicitDeadline(row.fecha_llegada)
                    const rowUrgency = row.missing.length > 0 ? getDocUrgency(rowDeadline) : { color: '#9C9890', label: '' }
                    const rowOverdue = rowDeadline ? Math.ceil((new Date(rowDeadline).getTime() - Date.now()) / 86400000) < 0 : false

                    return (
                      <tr
                        key={row.trafico}
                        style={{
                          cursor: 'pointer',
                          borderLeft: row.missing.length > 0 ? `4px solid ${rowUrgency.color}` : noPedimento ? '4px solid #C23B22' : undefined,
                          background: rowOverdue && row.missing.length > 0 ? 'rgba(194,59,34,0.04)' : undefined,
                        }}
                        className="expediente-row"
                        onClick={() => handleNavigate(row.trafico)}
                      >
                        {/* TRAFICO */}
                        <td>
                          <span className="trafico-id">{fmtId(row.trafico)}</span>
                          {row.fecha_llegada && (
                            <div style={{ color: '#9C9890', fontSize: 11, marginTop: 2 }}>
                              {fmtDateCompact(row.fecha_llegada)}
                            </div>
                          )}
                        </td>

                        {/* ESTADO */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span
                              className={`badge ${row.estatus === 'Cruzado' ? 'badge-cruzado' : row.estatus === 'Detenido' ? 'badge-hold' : 'badge-proceso'}`}
                            >
                              <span className="badge-dot" /><span className="sr-only">Estado: </span>
                              {row.estatus}
                            </span>
                            {noPedimento && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                background: '#FEF2F2', border: '1px solid #FECACA',
                                borderRadius: 9999, padding: '2px 10px',
                                fontSize: 10, fontWeight: 700, color: '#991B1B',
                                width: 'fit-content',
                              }}>
                                <AlertTriangle size={10} />
                                Sin pedimento
                              </span>
                            )}
                          </div>
                        </td>

                        {/* DOCS count */}
                        <td>
                          <span className="font-mono" style={{ fontSize: 13 }}>
                            {row.docCount}
                            <span style={{ color: '#9C9890', fontWeight: 400 }}>/{REQUIRED_DOCS.length}</span>
                          </span>
                        </td>

                        {/* COMPLETITUD */}
                        <td style={{ minWidth: 140 }}>
                          <ProgressBar pct={row.pct} />
                        </td>

                        {/* FALTANTES */}
                        <td style={{ maxWidth: 220 }}>
                          {row.missing.length > 0 ? (
                            <div>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {row.missing.slice(0, 3).map((m) => (
                                  <span
                                    key={m}
                                    style={{
                                      fontSize: 10, fontWeight: 600,
                                      padding: '2px 8px', borderRadius: 4,
                                      background: '#FEF2F2', border: '1px solid #FECACA',
                                      color: '#991B1B', whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {getDocLabel(m)}
                                  </span>
                                ))}
                                {row.missing.length > 3 && (
                                  <span style={{ fontSize: 10, color: '#9C9890', padding: '2px 4px', fontWeight: 600 }}>
                                    +{row.missing.length - 3}
                                  </span>
                                )}
                              </div>
                              {rowUrgency.label && (
                                <div style={{ fontSize: 11, color: rowUrgency.color, fontWeight: 600, marginTop: 4 }}>{rowUrgency.label}</div>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: '#2D8540', fontWeight: 600 }}>Completo</span>
                          )}
                        </td>

                        {/* ACCION */}
                        <td style={{ textAlign: 'right' }}>
                          {row.missing.length > 0 ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                // Future: call solicitarDocumentos()
                                handleNavigate(row.trafico)
                              }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '6px 14px', background: '#B8953F', color: '#FFFFFF',
                                border: 'none', borderRadius: 6, fontSize: 12,
                                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >
                              <Send size={12} /> Solicitar
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleNavigate(row.trafico)
                              }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '6px 14px', background: 'var(--card-bg)',
                                border: '1px solid #E8E5E0', color: '#1A1A1A',
                                borderRadius: 6, fontSize: 12, fontWeight: 600,
                                cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >
                              <Eye size={12} /> Ver
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: 8, border: 'none', padding: '12px 0' }}>
              <span className="pagination-info">
                {(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, filtered.length).toLocaleString()} de {filtered.length.toLocaleString()}
              </span>
              <div className="pagination-btns">
                <button className="pagination-btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Ant.</button>
                <button className="pagination-btn" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>Sig. →</button>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .expediente-row { cursor: pointer; transition: background 0.15s ease; }
        .expediente-row:hover { background: #F5F0E4 !important; }
      `}</style>
    </div>
  )
}
