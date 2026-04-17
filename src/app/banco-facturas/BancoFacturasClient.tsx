'use client'

// Block 8 · Invoice Bank — client surface.
//
// CLICK COUNT: cockpit → upload & classify & assign = 3 clicks
//   1. Open Banco de Facturas from nav
//   2. Drag file(s) onto drop zone (CFDI XML parse OR Sonnet PDF / Vision image)
//   3. Pick tráfico from assignment modal
// GLOBALPC EQUIVALENT: 6 clicks (Añadir Factura → upload → save → open tráfico → Asignar → confirm)
// PORTAL ADVANTAGE: 3 clicks saved per operation
//
// List + filter bar (status, supplier, currency, date range, amount range),
// bulk upload (drag-drop), right-rail PDF preview, bottom bar
// (Asignar · Archivar · Eliminar). Assignment modal reuses the universal
// search endpoint with entityId='traficos'.
//
// Silver palette, es-MX, JetBrains Mono for invoice numbers + amounts.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ACCENT_SILVER, ACCENT_SILVER_BRIGHT, ACCENT_SILVER_DIM,
  BG_CARD, BORDER, BORDER_HAIRLINE, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
  GREEN, AMBER, RED, GLOW_SILVER_SUBTLE,
} from '@/lib/design-system'
import type { InvoiceBankRow, InvoiceBankStatus } from '@/lib/invoice-bank'
import { trackEvent } from '@/lib/telemetry'

const MONO = 'var(--font-jetbrains-mono), JetBrains Mono, monospace'
const SANS = 'var(--font-geist-sans), Inter, system-ui, sans-serif'

interface Props {
  companyId: string
  role: string
}

interface FilterState {
  status: InvoiceBankStatus
  q: string
  currency: '' | 'MXN' | 'USD'
  dateFrom: string
  dateTo: string
  amountMin: string
  amountMax: string
}

const STATUS_LABEL: Record<InvoiceBankStatus, string> = {
  unassigned: 'Sin asignar',
  assigned: 'Asignadas',
  archived: 'Archivadas',
}

function fmtAmount(amount: number | null, currency: string | null): string {
  if (amount == null) return '—'
  const formatted = amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency ? `${formatted} ${currency}` : formatted
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      timeZone: 'America/Chicago',
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

export function BancoFacturasClient({ role }: Props) {
  const [filter, setFilter] = useState<FilterState>({
    status: 'unassigned', q: '', currency: '', dateFrom: '', dateTo: '', amountMin: '', amountMax: '',
  })
  const [rows, setRows] = useState<InvoiceBankRow[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)

  const pageTrackedRef = useRef(false)
  useEffect(() => {
    if (pageTrackedRef.current) return
    pageTrackedRef.current = true
    trackEvent('page_view', 'invoice_bank_opened', { role })
  }, [role])

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams()
    sp.set('status', filter.status)
    if (filter.q.trim()) sp.set('q', filter.q.trim())
    if (filter.currency) sp.set('currency', filter.currency)
    if (filter.dateFrom) sp.set('date_from', filter.dateFrom)
    if (filter.dateTo) sp.set('date_to', filter.dateTo)
    if (filter.amountMin) sp.set('amount_min', filter.amountMin)
    if (filter.amountMax) sp.set('amount_max', filter.amountMax)
    try {
      const res = await fetch(`/api/invoice-bank?${sp.toString()}`, { credentials: 'include' })
      const body = await res.json()
      if (body?.data) {
        setRows(body.data.rows ?? [])
        setTotal(body.data.meta?.total ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  )

  const onFiles = useCallback(async (list: FileList | null) => {
    if (!list || list.length === 0) return
    setUploadBusy(true)
    const form = new FormData()
    Array.from(list).forEach((f) => form.append('files', f))
    try {
      const res = await fetch('/api/invoice-bank/upload', {
        method: 'POST', body: form, credentials: 'include',
      })
      const body = await res.json()
      const results = body?.data?.results ?? []
      const count = results.length
      const visionCount = results.filter(
        (r: { visionExtracted?: boolean }) => r.visionExtracted,
      ).length
      const tail =
        visionCount > 0
          ? ` · ${visionCount} extraída${visionCount === 1 ? '' : 's'} por PORTAL`
          : ''
      setToast(`${count} factura${count === 1 ? '' : 's'} cargada${count === 1 ? '' : 's'}${tail}`)
      trackEvent('click', 'invoice_uploaded', { count, vision_extracted: visionCount })
      // Classification telemetry — one per classified row.
      for (const r of results) {
        if (r.classified) trackEvent('click', 'invoice_classified', { invoice_id: r.id })
        if (r.visionExtracted) {
          trackEvent('click', 'document_classified', {
            invoice_id: r.id,
            doc_type: r.visionDocType,
            classification_id: r.visionClassificationId,
          })
        }
      }
      await load()
    } catch {
      setToast('Error al cargar archivos')
    } finally {
      setUploadBusy(false)
    }
  }, [load])

  const onAssign = useCallback(async (traficoId: string) => {
    if (!selectedId) return
    const res = await fetch(`/api/invoice-bank/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign', traficoId }),
      credentials: 'include',
    })
    const body = await res.json()
    if (body?.data) {
      setToast(`Factura asignada a ${traficoId}`)
      trackEvent('click', 'invoice_assigned', { invoice_id: selectedId, trafico_id: traficoId })
      setAssignOpen(false)
      setSelectedId(null)
      await load()
    } else {
      setToast(body?.error?.message ?? 'Error al asignar')
    }
  }, [selectedId, load])

  const onArchive = useCallback(async () => {
    if (!selectedId) return
    const res = await fetch(`/api/invoice-bank/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive' }),
      credentials: 'include',
    })
    const body = await res.json()
    if (body?.data) {
      setToast('Factura archivada')
      trackEvent('click', 'invoice_archived', { invoice_id: selectedId })
      setSelectedId(null)
      await load()
    } else {
      setToast(body?.error?.message ?? 'Error al archivar')
    }
  }, [selectedId, load])

  const onDelete = useCallback(async () => {
    if (!selectedId) return
    if (!confirm('¿Eliminar esta factura? Se archivará como borrada.')) return
    const res = await fetch(`/api/invoice-bank/${selectedId}`, {
      method: 'DELETE', credentials: 'include',
    })
    const body = await res.json()
    if (body?.data) {
      setToast('Factura eliminada')
      trackEvent('click', 'invoice_deleted', { invoice_id: selectedId })
      setSelectedId(null)
      await load()
    } else {
      setToast(body?.error?.message ?? 'Error al eliminar')
    }
  }, [selectedId, load])

  return (
    <div style={{
      minHeight: '100vh', padding: 24, color: TEXT_PRIMARY,
      fontFamily: SANS,
      display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 16,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <header style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontSize: 'var(--aguila-fs-title)', fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>
            Banco de facturas
          </h1>
          <span style={{ fontFamily: MONO, fontSize: 'var(--aguila-fs-compact)', color: TEXT_MUTED }}>
            {total} {total === 1 ? 'factura' : 'facturas'}
          </span>
        </header>

        <FilterBar filter={filter} onChange={setFilter} />

        <DropZone busy={uploadBusy} onFiles={onFiles} />

        <div style={{
          background: BG_CARD, backdropFilter: 'blur(20px)',
          border: `1px solid ${BORDER}`, borderRadius: 20,
          boxShadow: `0 0 1px ${GLOW_SILVER_SUBTLE}`,
          overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: TEXT_MUTED }}>Cargando…</div>
          ) : rows.length === 0 ? (
            <EmptyState status={filter.status} />
          ) : (
            <div role="list">
              {rows.map((row) => (
                <InvoiceRow
                  key={row.id}
                  row={row}
                  active={row.id === selectedId}
                  onSelect={() => setSelectedId(row.id)}
                />
              ))}
            </div>
          )}
        </div>

        {selectedId && (
          <BottomBar
            canAssign={selected?.status === 'unassigned'}
            canArchive={selected?.status !== 'archived'}
            onAssignClick={() => setAssignOpen(true)}
            onArchiveClick={onArchive}
            onDeleteClick={onDelete}
          />
        )}

        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: BG_CARD, backdropFilter: 'blur(20px)',
            border: `1px solid ${BORDER}`, borderRadius: 12,
            padding: '12px 20px', color: TEXT_PRIMARY, fontSize: 'var(--aguila-fs-section)',
            boxShadow: `0 0 20px ${GLOW_SILVER_SUBTLE}`,
          }}>
            {toast}
            <button
              type="button"
              onClick={() => setToast(null)}
              style={{
                marginLeft: 12, background: 'transparent', border: 'none',
                color: ACCENT_SILVER_DIM, cursor: 'pointer', fontSize: 'var(--aguila-fs-compact)',
                minWidth: 44, minHeight: 44,
              }}
              aria-label="Cerrar aviso"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {selected && (
        <RightRail
          row={selected}
          onClose={() => setSelectedId(null)}
        />
      )}

      {assignOpen && selected && (
        <AssignModal
          onClose={() => setAssignOpen(false)}
          onAssign={onAssign}
        />
      )}
    </div>
  )
}

function FilterBar({ filter, onChange }: { filter: FilterState; onChange: (f: FilterState) => void }) {
  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER_HAIRLINE}`,
    borderRadius: 10, color: TEXT_PRIMARY, fontFamily: SANS, fontSize: 'var(--aguila-fs-section)',
    padding: '10px 12px', minHeight: 44, minWidth: 0,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--aguila-fs-label)', letterSpacing: '0.08em', textTransform: 'uppercase',
    color: TEXT_MUTED, marginBottom: 4,
  }
  return (
    <div style={{
      background: BG_CARD, backdropFilter: 'blur(20px)',
      border: `1px solid ${BORDER}`, borderRadius: 20, padding: 16,
      display: 'grid', gap: 12,
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    }}>
      <div>
        <div style={labelStyle}>Estado</div>
        <select
          value={filter.status}
          onChange={(e) => onChange({ ...filter, status: e.target.value as InvoiceBankStatus })}
          style={inputStyle}
          aria-label="Filtrar por estado"
        >
          <option value="unassigned">Sin asignar</option>
          <option value="assigned">Asignadas</option>
          <option value="archived">Archivadas</option>
        </select>
      </div>
      <div>
        <div style={labelStyle}>Proveedor</div>
        <input
          type="text" value={filter.q} placeholder="Buscar proveedor…"
          onChange={(e) => onChange({ ...filter, q: e.target.value })}
          style={inputStyle}
          aria-label="Filtrar por proveedor"
        />
      </div>
      <div>
        <div style={labelStyle}>Moneda</div>
        <select
          value={filter.currency}
          onChange={(e) => onChange({ ...filter, currency: e.target.value as FilterState['currency'] })}
          style={inputStyle}
          aria-label="Filtrar por moneda"
        >
          <option value="">Todas</option>
          <option value="MXN">MXN</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <div>
        <div style={labelStyle}>Desde</div>
        <input
          type="date" value={filter.dateFrom}
          onChange={(e) => onChange({ ...filter, dateFrom: e.target.value })}
          style={inputStyle} aria-label="Fecha desde"
        />
      </div>
      <div>
        <div style={labelStyle}>Hasta</div>
        <input
          type="date" value={filter.dateTo}
          onChange={(e) => onChange({ ...filter, dateTo: e.target.value })}
          style={inputStyle} aria-label="Fecha hasta"
        />
      </div>
      <div>
        <div style={labelStyle}>Monto mín.</div>
        <input
          type="number" value={filter.amountMin} step="0.01" min="0"
          onChange={(e) => onChange({ ...filter, amountMin: e.target.value })}
          style={{ ...inputStyle, fontFamily: MONO }} aria-label="Monto mínimo"
        />
      </div>
      <div>
        <div style={labelStyle}>Monto máx.</div>
        <input
          type="number" value={filter.amountMax} step="0.01" min="0"
          onChange={(e) => onChange({ ...filter, amountMax: e.target.value })}
          style={{ ...inputStyle, fontFamily: MONO }} aria-label="Monto máximo"
        />
      </div>
    </div>
  )
}

function DropZone({ busy, onFiles }: { busy: boolean; onFiles: (list: FileList | null) => void }) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragActive(false)
        onFiles(e.dataTransfer.files)
      }}
      style={{
        border: `1px dashed ${dragActive ? ACCENT_SILVER_BRIGHT : BORDER}`,
        background: dragActive ? 'rgba(192,197,206,0.06)' : BG_CARD,
        backdropFilter: 'blur(20px)',
        borderRadius: 20, padding: 20, textAlign: 'center',
        color: TEXT_SECONDARY, fontSize: 'var(--aguila-fs-section)',
      }}
    >
      <input
        ref={inputRef} type="file" multiple
        accept="application/pdf,application/xml,text/xml,image/jpeg,image/png,image/webp"
        onChange={(e) => onFiles(e.target.files)}
        style={{ display: 'none' }}
        aria-label="Seleccionar archivos de factura"
      />
      {busy ? (
        <span>Cargando facturas…</span>
      ) : (
        <>
          <div style={{ marginBottom: 8 }}>Arrastra PDFs, XMLs o imágenes de facturas aquí</div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              background: ACCENT_SILVER, color: '#0A0A0C',
              border: 'none', borderRadius: 10, padding: '10px 16px',
              fontWeight: 600, fontSize: 'var(--aguila-fs-section)', cursor: 'pointer',
              minHeight: 44, minWidth: 44,
            }}
          >
            Seleccionar archivos
          </button>
        </>
      )}
    </div>
  )
}

function InvoiceRow({ row, active, onSelect }: {
  row: InvoiceBankRow; active: boolean; onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="listitem"
      onClick={onSelect}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1.2fr auto',
        alignItems: 'center', gap: 16,
        width: '100%', minHeight: 60, textAlign: 'left',
        padding: '12px 20px',
        background: active ? 'rgba(192,197,206,0.06)' : 'transparent',
        borderLeft: active ? `2px solid ${ACCENT_SILVER}` : '2px solid transparent',
        borderBottom: `1px solid ${BORDER_HAIRLINE}`,
        border: 'none', borderRadius: 0, cursor: 'pointer',
        color: TEXT_PRIMARY,
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: 'var(--aguila-fs-section)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {row.invoice_number ?? 'Sin número'}
      </span>
      <span style={{ fontSize: 'var(--aguila-fs-section)', color: TEXT_SECONDARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {row.supplier_name ?? 'Proveedor pendiente'}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 'var(--aguila-fs-section)', color: TEXT_PRIMARY }}>
        {fmtAmount(row.amount, row.currency)}
      </span>
      <span style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_MUTED, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {fmtDate(row.received_at)}
      </span>
    </button>
  )
}

function EmptyState({ status }: { status: InvoiceBankStatus }) {
  const msg =
    status === 'unassigned'
      ? 'Sin facturas por asignar. Carga un PDF o XML para empezar.'
      : status === 'assigned'
      ? 'Aún no hay facturas asignadas a embarques.'
      : 'Sin facturas archivadas.'
  return (
    <div style={{ padding: 48, textAlign: 'center', color: TEXT_MUTED, fontSize: 'var(--aguila-fs-section)' }}>
      <div style={{ marginBottom: 8, fontSize: 'var(--aguila-fs-kpi-mid)' }} aria-hidden>🗂️</div>
      <div>{msg}</div>
    </div>
  )
}

function BottomBar({ canAssign, canArchive, onAssignClick, onArchiveClick, onDeleteClick }: {
  canAssign: boolean; canArchive: boolean
  onAssignClick: () => void; onArchiveClick: () => void; onDeleteClick: () => void
}) {
  const btn = (color: string): React.CSSProperties => ({
    background: 'rgba(255,255,255,0.03)', color,
    border: `1px solid ${BORDER}`, borderRadius: 10,
    padding: '12px 20px', fontWeight: 600, fontSize: 'var(--aguila-fs-section)',
    cursor: 'pointer', minHeight: 60, minWidth: 60,
  })
  return (
    <div style={{
      position: 'sticky', bottom: 0,
      background: BG_CARD, backdropFilter: 'blur(20px)',
      border: `1px solid ${BORDER}`, borderRadius: 16, padding: 12,
      display: 'flex', gap: 8, justifyContent: 'flex-end',
    }}>
      <button type="button" onClick={onAssignClick} disabled={!canAssign}
        style={{ ...btn(canAssign ? ACCENT_SILVER_BRIGHT : ACCENT_SILVER_DIM),
          opacity: canAssign ? 1 : 0.5, cursor: canAssign ? 'pointer' : 'not-allowed' }}>
        Asignar
      </button>
      <button type="button" onClick={onArchiveClick} disabled={!canArchive}
        style={{ ...btn(AMBER), opacity: canArchive ? 1 : 0.5,
          cursor: canArchive ? 'pointer' : 'not-allowed' }}>
        Archivar
      </button>
      <button type="button" onClick={onDeleteClick} style={btn(RED)}>
        Eliminar
      </button>
    </div>
  )
}

interface VisionChipState {
  id: string | null
  supplier: string | null
  invoiceNumber: string | null
  docType: string | null
  confirmedAt: string | null
  loaded: boolean
}

function RightRail({ row, onClose }: { row: InvoiceBankRow; onClose: () => void }) {
  const isPdf = row.file_url?.toLowerCase().endsWith('.pdf') ?? false
  const [chip, setChip] = useState<VisionChipState>({
    id: null, supplier: null, invoiceNumber: null, docType: null, confirmedAt: null, loaded: false,
  })
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let cancelled = false
    setChip({ id: null, supplier: null, invoiceNumber: null, docType: null, confirmedAt: null, loaded: false })
    fetch(`/api/vision/classifications?invoiceBankId=${row.id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return
        const c = body?.data?.classification ?? null
        setChip({
          id: c?.id ?? null,
          supplier: c?.supplier ?? null,
          invoiceNumber: c?.invoice_number ?? null,
          docType: c?.doc_type ?? null,
          confirmedAt: c?.confirmed_at ?? null,
          loaded: true,
        })
      })
      .catch(() => setChip((s) => ({ ...s, loaded: true })))
    return () => { cancelled = true }
  }, [row.id])

  const onConfirm = useCallback(async (match: boolean) => {
    if (!chip.id) return
    setConfirming(true)
    try {
      const res = await fetch(`/api/vision/classifications/${chip.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match }),
        credentials: 'include',
      })
      const body = await res.json()
      if (body?.data?.confirmed_at) {
        setChip((s) => ({ ...s, confirmedAt: body.data.confirmed_at }))
      }
    } finally {
      setConfirming(false)
    }
  }, [chip.id])

  return (
    <aside style={{
      background: BG_CARD, backdropFilter: 'blur(20px)',
      border: `1px solid ${BORDER}`, borderRadius: 20, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
      height: 'calc(100vh - 48px)', position: 'sticky', top: 24,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ fontSize: 'var(--aguila-fs-section)', margin: 0, fontWeight: 600 }}>Vista previa</h2>
        <button type="button" onClick={onClose}
          style={{
            background: 'transparent', border: 'none', color: TEXT_MUTED,
            cursor: 'pointer', minWidth: 44, minHeight: 44, fontSize: 'var(--aguila-fs-section)',
          }}
          aria-label="Cerrar vista previa">
          Cerrar
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 6, fontSize: 'var(--aguila-fs-compact)' }}>
        <span style={{ color: TEXT_MUTED }}>Folio</span>
        <span style={{ fontFamily: MONO, color: TEXT_PRIMARY }}>{row.invoice_number ?? '—'}</span>
        <span style={{ color: TEXT_MUTED }}>Proveedor</span>
        <span style={{ color: TEXT_PRIMARY }}>{row.supplier_name ?? '—'}</span>
        <span style={{ color: TEXT_MUTED }}>Monto</span>
        <span style={{ fontFamily: MONO, color: TEXT_PRIMARY }}>{fmtAmount(row.amount, row.currency)}</span>
        <span style={{ color: TEXT_MUTED }}>Recibida</span>
        <span style={{ color: TEXT_PRIMARY }}>{fmtDate(row.received_at)}</span>
        <span style={{ color: TEXT_MUTED }}>Estado</span>
        <span style={{ color: row.status === 'assigned' ? GREEN : ACCENT_SILVER }}>
          {STATUS_LABEL[row.status]}
        </span>
        {row.assigned_to_trafico_id && (
          <>
            <span style={{ color: TEXT_MUTED }}>Embarque</span>
            <span style={{ fontFamily: MONO, color: TEXT_PRIMARY }}>{row.assigned_to_trafico_id}</span>
          </>
        )}
      </div>
      {chip.loaded && chip.id && (
        <div
          style={{
            background: 'rgba(192,197,206,0.06)',
            border: `1px solid ${BORDER_HAIRLINE}`,
            borderRadius: 12,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 'var(--aguila-fs-compact)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 'var(--aguila-fs-meta)',
                fontWeight: 600,
                color: ACCENT_SILVER_BRIGHT,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Extraído por PORTAL
            </span>
            {chip.docType && (
              <span style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, fontFamily: MONO }}>
                · {chip.docType}
              </span>
            )}
          </div>
          {chip.confirmedAt ? (
            <span style={{ color: GREEN, fontSize: 'var(--aguila-fs-meta)' }}>
              Confirmado {fmtDate(chip.confirmedAt)}
            </span>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => onConfirm(true)}
                disabled={confirming}
                style={{
                  flex: 1,
                  minHeight: 44,
                  padding: '8px 12px',
                  background: 'rgba(192,197,206,0.10)',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  color: ACCENT_SILVER_BRIGHT,
                  fontSize: 'var(--aguila-fs-compact)',
                  fontWeight: 600,
                  cursor: confirming ? 'wait' : 'pointer',
                }}
              >
                Confirmar extracción
              </button>
              <button
                type="button"
                onClick={() => onConfirm(false)}
                disabled={confirming}
                style={{
                  minHeight: 44,
                  padding: '8px 12px',
                  background: 'transparent',
                  border: `1px solid ${BORDER_HAIRLINE}`,
                  borderRadius: 8,
                  color: TEXT_MUTED,
                  fontSize: 'var(--aguila-fs-compact)',
                  cursor: confirming ? 'wait' : 'pointer',
                }}
                title="Marcar como revisión manual necesaria"
              >
                Revisar
              </button>
            </div>
          )}
        </div>
      )}
      {row.file_url ? (
        isPdf ? (
          <iframe
            src={row.file_url} title="Vista previa de factura"
            style={{ flex: 1, width: '100%', border: `1px solid ${BORDER_HAIRLINE}`, borderRadius: 12, background: '#fff' }}
          />
        ) : (
          <a href={row.file_url} target="_blank" rel="noopener noreferrer"
            style={{ color: ACCENT_SILVER_BRIGHT, fontSize: 'var(--aguila-fs-body)', textDecoration: 'underline' }}>
            Abrir archivo
          </a>
        )
      ) : (
        <div style={{ color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>Sin archivo adjunto</div>
      )}
    </aside>
  )
}

interface TraficoHit { id: string; kind: string; title: string; subtitle?: string | null }

function AssignModal({ onClose, onAssign }: {
  onClose: () => void; onAssign: (traficoId: string) => Promise<void>
}) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<TraficoHit[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    let cancelled = false
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/search/universal?q=${encodeURIComponent(q.trim())}`, {
          credentials: 'include',
        })
        const body = await res.json()
        if (cancelled) return
        const traficos = (body?.data?.traficos ?? []) as TraficoHit[]
        setHits(traficos.slice(0, 10))
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 180)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q])

  return (
    <div
      role="dialog" aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(255,255,255,0.045)', backdropFilter: 'blur(20px)',
          border: `1px solid ${BORDER}`, borderRadius: 20, padding: 20,
          width: 'min(520px, 92vw)', color: TEXT_PRIMARY,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700 }}>Asignar a embarque</h2>
        <p style={{ color: TEXT_MUTED, fontSize: 'var(--aguila-fs-compact)', margin: '4px 0 12px' }}>
          Busca por clave de embarque, pedimento o descripción.
        </p>
        <input
          autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Ej. 1234 o 26 24 3596 6500441"
          style={{
            width: '100%', background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${BORDER_HAIRLINE}`, borderRadius: 10,
            color: TEXT_PRIMARY, fontFamily: MONO, fontSize: 'var(--aguila-fs-section)',
            padding: '10px 12px', minHeight: 44,
          }}
          aria-label="Buscar embarque"
        />
        <div style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto' }}>
          {searching && <div style={{ color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)', padding: 8 }}>Buscando…</div>}
          {!searching && q.trim().length >= 2 && hits.length === 0 && (
            <div style={{ color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)', padding: 8 }}>Sin coincidencias</div>
          )}
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onAssign(h.title)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                width: '100%', textAlign: 'left', padding: '10px 12px',
                background: 'transparent', border: 'none', borderRadius: 8,
                color: TEXT_PRIMARY, cursor: 'pointer', minHeight: 60,
                gap: 2,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(192,197,206,0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontFamily: MONO, fontSize: 'var(--aguila-fs-section)', fontWeight: 600 }}>{h.title}</span>
              {h.subtitle && <span style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_MUTED }}>{h.subtitle}</span>}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" onClick={onClose}
            style={{
              background: 'transparent', color: TEXT_SECONDARY, border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: '10px 16px', cursor: 'pointer',
              minHeight: 44, minWidth: 44, fontSize: 'var(--aguila-fs-section)',
            }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
