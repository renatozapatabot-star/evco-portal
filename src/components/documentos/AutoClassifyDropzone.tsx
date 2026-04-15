'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Upload, CheckCircle, AlertTriangle, XCircle, Loader2, Link2, Paperclip, FileText, Truck } from 'lucide-react'
import { GlassCard } from '@/components/aguila'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
  GREEN, AMBER, RED, BORDER_HAIRLINE,
} from '@/lib/design-system'
import { BatchAnalysisCard, type BatchAnalysisSummary } from './BatchAnalysisCard'

interface TraficoOption {
  trafico: string
  descripcion_mercancia: string | null
  estatus: string | null
}

type ItemStatus = 'uploading' | 'classifying' | 'ready' | 'review' | 'missing' | 'error'

interface DropItem {
  localId: string
  source: 'file' | 'text'
  fileName: string
  sizeBytes: number
  status: ItemStatus
  typeLabel?: string
  typeKey?: string
  issues?: string[]
  linkedTraficoId?: string | null
  supplier?: string | null
  amount?: number | null
  currency?: string | null
  errorMessage?: string
}

const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png']
const ACCEPTED_EXT = '.pdf,.jpg,.jpeg,.png'
const MAX_SIZE = 10 * 1024 * 1024
const CONCURRENCY = 3

type Mode = 'archivos' | 'descripcion'

function statusTone(s: ItemStatus): { color: string; label: string } {
  switch (s) {
    case 'ready':
      return { color: GREEN, label: 'Listo' }
    case 'review':
      return { color: AMBER, label: 'Revisar' }
    case 'missing':
      return { color: RED, label: 'Falta información' }
    case 'error':
      return { color: RED, label: 'Error' }
    case 'uploading':
      return { color: TEXT_SECONDARY, label: 'Subiendo…' }
    case 'classifying':
      return { color: TEXT_SECONDARY, label: 'Analizando…' }
  }
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === 'uploading' || status === 'classifying') {
    return <Loader2 size={20} className="aguila-spin" aria-hidden />
  }
  if (status === 'ready') return <CheckCircle size={20} color={GREEN} aria-hidden />
  if (status === 'review') return <AlertTriangle size={20} color={AMBER} aria-hidden />
  return <XCircle size={20} color={RED} aria-hidden />
}

function formatAmount(amount: number | null | undefined, currency: string | null | undefined): string | null {
  if (amount === null || amount === undefined || !currency) return null
  try {
    return `${amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
  } catch {
    return `${amount} ${currency}`
  }
}

/**
 * Simple concurrency gate. Awaits a slot before running `fn`.
 * Keeps Anthropic rate-limit happy and keeps the UI responsive
 * when the user drops 10 files at once.
 */
function makeSemaphore(max: number) {
  let active = 0
  const queue: Array<() => void> = []
  const acquire = () =>
    new Promise<void>((resolve) => {
      const tryRun = () => {
        if (active < max) {
          active += 1
          resolve()
        } else {
          queue.push(tryRun)
        }
      }
      tryRun()
    })
  const release = () => {
    active -= 1
    const next = queue.shift()
    if (next) next()
  }
  return { acquire, release }
}

export function AutoClassifyDropzone() {
  const [mode, setMode] = useState<Mode>('archivos')
  const [items, setItems] = useState<DropItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [textSubmitting, setTextSubmitting] = useState(false)
  const [traficoOptions, setTraficoOptions] = useState<TraficoOption[]>([])
  const [selectedTrafico, setSelectedTrafico] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const semaphoreRef = useRef(makeSemaphore(CONCURRENCY))

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const params = new URLSearchParams({
          table: 'traficos',
          limit: '50',
          order_by: 'updated_at',
          order_dir: 'desc',
        })
        const res = await fetch(`/api/data?${params.toString()}`)
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        const rows = (json.data ?? []) as Array<{ trafico?: string; descripcion_mercancia?: string | null; estatus?: string | null }>
        const opts = rows
          .filter((r) => typeof r.trafico === 'string' && r.trafico.length > 0)
          .map((r) => ({
            trafico: r.trafico as string,
            descripcion_mercancia: r.descripcion_mercancia ?? null,
            estatus: r.estatus ?? null,
          }))
        setTraficoOptions(opts)
      } catch {
        // Silent — picker stays empty, Claude auto-detect still works.
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const processFile = useCallback(async (file: File) => {
    const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    if (!ACCEPTED_MIME.includes(file.type)) {
      setItems((prev) => [...prev, {
        localId, source: 'file', fileName: file.name, sizeBytes: file.size,
        status: 'error', errorMessage: 'Solo PDF, JPG o PNG',
      }])
      return
    }
    if (file.size > MAX_SIZE) {
      setItems((prev) => [...prev, {
        localId, source: 'file', fileName: file.name, sizeBytes: file.size,
        status: 'error', errorMessage: 'Archivo excede 10 MB',
      }])
      return
    }

    setItems((prev) => [...prev, {
      localId, source: 'file', fileName: file.name, sizeBytes: file.size, status: 'uploading',
    }])

    await semaphoreRef.current.acquire()
    try {
      let docId: string | null = null
      try {
        const fd = new FormData()
        fd.append('file', file)
        if (selectedTrafico) fd.append('trafico_id', selectedTrafico)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
        const uploadJson = await uploadRes.json()
        if (!uploadRes.ok || uploadJson.error) throw new Error(uploadJson.error?.message ?? 'Error al subir')
        docId = uploadJson.data?.doc_id ?? null
        if (!docId) throw new Error('El servidor no devolvió documentId')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al subir'
        setItems((prev) => prev.map((it) => it.localId === localId
          ? { ...it, status: 'error', errorMessage: msg } : it))
        return
      }

      setItems((prev) => prev.map((it) => it.localId === localId
        ? { ...it, status: 'classifying' } : it))

      try {
        const res = await fetch('/api/documentos/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: docId }),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Error al clasificar')
        const d = json.data as {
          status: 'ready' | 'review' | 'missing'
          type: string
          type_label: string
          issues: string[]
          linked_trafico_id: string | null
          supplier: string | null
          amount: number | null
          currency: string | null
        }
        setItems((prev) => prev.map((it) => it.localId === localId
          ? {
              ...it,
              status: d.status,
              typeKey: d.type,
              typeLabel: d.type_label,
              issues: d.issues,
              linkedTraficoId: d.linked_trafico_id,
              supplier: d.supplier,
              amount: d.amount,
              currency: d.currency,
            }
          : it))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al clasificar'
        setItems((prev) => prev.map((it) => it.localId === localId
          ? { ...it, status: 'error', errorMessage: msg } : it))
      }
    } finally {
      semaphoreRef.current.release()
    }
  }, [])

  const onFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    Array.from(files).forEach((f) => { void processFile(f) })
  }, [processFile])

  const submitText = useCallback(async () => {
    const text = textInput.trim()
    if (text.length < 10) return
    const localId = `txt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const preview = text.length > 80 ? text.slice(0, 77) + '…' : text
    setItems((prev) => [...prev, {
      localId, source: 'text', fileName: preview, sizeBytes: text.length, status: 'classifying',
    }])
    setTextSubmitting(true)
    try {
      const res = await fetch('/api/documentos/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Error al analizar')
      const d = json.data as {
        status: 'ready' | 'review' | 'missing'
        type: string
        type_label: string
        issues: string[]
        linked_trafico_id: string | null
        supplier: string | null
        amount: number | null
        currency: string | null
      }
      setItems((prev) => prev.map((it) => it.localId === localId
        ? {
            ...it,
            status: d.status,
            typeKey: d.type,
            typeLabel: d.type_label,
            issues: d.issues,
            linkedTraficoId: d.linked_trafico_id,
            supplier: d.supplier,
            amount: d.amount,
            currency: d.currency,
          }
        : it))
      setTextInput('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al analizar'
      setItems((prev) => prev.map((it) => it.localId === localId
        ? { ...it, status: 'error', errorMessage: msg } : it))
    } finally {
      setTextSubmitting(false)
    }
  }, [textInput])

  const allSettled = items.length > 0 && items.every((it) =>
    it.status !== 'uploading' && it.status !== 'classifying')

  const summary: BatchAnalysisSummary | null = useMemo(() => {
    if (!allSettled || items.length < 2) return null
    let ready = 0, review = 0, missing = 0
    const byTypeMap = new Map<string, number>()
    const linked = new Set<string>()
    const issueCounts = new Map<string, number>()
    const currencyTotals = new Map<string, number>()

    for (const it of items) {
      if (it.status === 'ready') ready += 1
      else if (it.status === 'review') review += 1
      else missing += 1
      if (it.typeLabel) byTypeMap.set(it.typeLabel, (byTypeMap.get(it.typeLabel) ?? 0) + 1)
      if (it.linkedTraficoId) linked.add(it.linkedTraficoId)
      for (const msg of it.issues ?? []) {
        issueCounts.set(msg, (issueCounts.get(msg) ?? 0) + 1)
      }
      if (it.amount !== null && it.amount !== undefined && it.currency) {
        const cur = it.currency.toUpperCase()
        currencyTotals.set(cur, (currencyTotals.get(cur) ?? 0) + it.amount)
      }
    }

    const byType = Array.from(byTypeMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
    const topIssues = Array.from(issueCounts.entries())
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    const totalsByCurrency = Array.from(currencyTotals.entries())
      .map(([currency, total]) => ({ currency, total }))

    return {
      total: items.length,
      ready,
      review,
      missing,
      byType,
      linkedTraficos: Array.from(linked),
      topIssues,
      totalsByCurrency,
    }
  }, [items, allSettled])

  const selectedOption = traficoOptions.find((t) => t.trafico === selectedTrafico)

  return (
    <>
      {/* Trafico picker (optional) */}
      <GlassCard size="compact">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label
            htmlFor="documentos-auto-trafico"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 'var(--aguila-fs-label, 10px)',
              letterSpacing: 'var(--aguila-ls-label, 0.08em)',
              textTransform: 'uppercase',
              color: TEXT_MUTED,
            }}
          >
            <Truck size={14} aria-hidden />
            Vincular a embarque (opcional)
          </label>
          <select
            id="documentos-auto-trafico"
            value={selectedTrafico}
            onChange={(e) => setSelectedTrafico(e.target.value)}
            style={{
              width: '100%',
              minHeight: 60,
              padding: '0 16px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${BORDER_HAIRLINE}`,
              color: TEXT_PRIMARY,
              fontSize: 14,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontWeight: 500,
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="" style={{ background: '#0B1220', color: TEXT_PRIMARY }}>
              Auto-detectar desde el documento
            </option>
            {traficoOptions.map((t) => (
              <option key={t.trafico} value={t.trafico} style={{ background: '#0B1220', color: TEXT_PRIMARY }}>
                {t.trafico}{t.descripcion_mercancia ? ` · ${t.descripcion_mercancia.slice(0, 40)}` : ''}{t.estatus ? ` · ${t.estatus}` : ''}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: TEXT_MUTED }}>
            {selectedOption
              ? 'Los archivos subidos se enlazarán directo a este embarque.'
              : 'Si no eliges, ZAPATA AI detecta el pedimento en el documento y lo enlaza solo.'}
          </span>
        </div>
      </GlassCard>

      {/* Mode toggle */}
      <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER_HAIRLINE}` }}>
        <ModeButton active={mode === 'archivos'} onClick={() => setMode('archivos')} icon={<Paperclip size={16} aria-hidden />} label="Archivos" />
        <ModeButton active={mode === 'descripcion'} onClick={() => setMode('descripcion')} icon={<FileText size={16} aria-hidden />} label="Descripción" />
      </div>

      {mode === 'archivos' ? (
        <GlassCard>
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files)
            }}
            aria-label="Arrastra o elige documentos para clasificar"
            style={{
              minHeight: 180,
              border: `2px dashed ${dragOver ? GREEN : BORDER_HAIRLINE}`,
              borderRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
              cursor: 'pointer',
              background: dragOver ? 'rgba(34,197,94,0.06)' : 'transparent',
              transition: 'background 160ms ease, border-color 160ms ease',
            }}
          >
            <Upload size={32} color={TEXT_SECONDARY} aria-hidden />
            <div style={{ marginTop: 12, color: TEXT_PRIMARY, fontSize: 16, fontWeight: 600 }}>
              Arrastra uno o varios documentos
            </div>
            <div style={{ marginTop: 4, color: TEXT_MUTED, fontSize: 13 }}>
              PDF, JPG o PNG · 10 MB máx. · hasta 3 en paralelo
            </div>
            <div style={{
              marginTop: 16,
              minHeight: 60,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 20px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              color: TEXT_PRIMARY,
              fontSize: 14,
              fontWeight: 600,
            }}>
              Elegir archivos
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXT}
              multiple
              onChange={(e) => onFiles(e.target.files)}
              style={{ display: 'none' }}
            />
          </div>
        </GlassCard>
      ) : (
        <GlassCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label
              htmlFor="documentos-auto-text"
              style={{
                fontSize: 'var(--aguila-fs-label, 10px)',
                letterSpacing: 'var(--aguila-ls-label, 0.08em)',
                textTransform: 'uppercase',
                color: TEXT_MUTED,
              }}
            >
              Pega aquí una factura, correo de proveedor o lista de productos
            </label>
            <textarea
              id="documentos-auto-text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              rows={8}
              maxLength={8000}
              placeholder="Ejemplo: factura 12345 de Duratech, pedimento 26 24 3596 6500441, 12 piezas de resina código 3901.20.01 por 15,420 USD…"
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${BORDER_HAIRLINE}`,
                color: TEXT_PRIMARY,
                fontSize: 14,
                lineHeight: 1.5,
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 11, color: TEXT_MUTED }}>
                {textInput.length} / 8000
              </span>
              <button
                type="button"
                onClick={() => { void submitText() }}
                disabled={textSubmitting || textInput.trim().length < 10}
                style={{
                  marginLeft: 'auto',
                  minHeight: 60,
                  padding: '0 24px',
                  borderRadius: 12,
                  background: textSubmitting || textInput.trim().length < 10
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(234,179,8,0.9)',
                  border: '1px solid rgba(234,179,8,0.3)',
                  color: textSubmitting || textInput.trim().length < 10 ? TEXT_MUTED : '#0a0a0c',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: textSubmitting || textInput.trim().length < 10 ? 'not-allowed' : 'pointer',
                  transition: 'background 160ms ease',
                }}
              >
                {textSubmitting ? 'Analizando…' : 'Analizar descripción'}
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Per-item cards */}
      {items.length > 0 ? (
        <div style={{ display: 'grid', gap: 'var(--aguila-gap-card, 16px)' }}>
          {items.map((it) => {
            const tone = statusTone(it.status)
            const amountLabel = formatAmount(it.amount, it.currency)
            return (
              <GlassCard key={it.localId} size="compact"
                severity={it.status === 'ready' ? 'healthy' : it.status === 'review' ? 'warning' : it.status === 'missing' || it.status === 'error' ? 'critical' : undefined}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flexShrink: 0, paddingTop: 2 }}>
                    <StatusIcon status={it.status} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>
                        {it.source === 'text' ? `"${it.fileName}"` : it.fileName}
                      </span>
                      <span style={{
                        color: tone.color,
                        fontSize: 'var(--aguila-fs-label, 10px)',
                        letterSpacing: 'var(--aguila-ls-label, 0.08em)',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                      }}>
                        {tone.label}
                      </span>
                    </div>
                    {it.typeLabel ? (
                      <div style={{ marginTop: 2, color: TEXT_SECONDARY, fontSize: 13 }}>
                        {it.typeLabel}
                        {it.supplier ? ` · ${it.supplier}` : ''}
                        {amountLabel ? (
                          <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            {' · '}{amountLabel}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {it.linkedTraficoId ? (
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, color: GREEN, fontSize: 12 }}>
                        <Link2 size={14} aria-hidden />
                        <span>
                          Enlazado al embarque{' '}
                          <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            {it.linkedTraficoId}
                          </span>
                        </span>
                      </div>
                    ) : null}

                    {it.issues && it.issues.length > 0 ? (
                      <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18, color: TEXT_SECONDARY, fontSize: 12, lineHeight: 1.5 }}>
                        {it.issues.map((msg, idx) => (
                          <li key={idx}>{msg}</li>
                        ))}
                      </ul>
                    ) : null}

                    {it.errorMessage ? (
                      <div style={{ marginTop: 6, color: RED, fontSize: 12 }}>
                        {it.errorMessage}
                      </div>
                    ) : null}
                  </div>
                </div>
              </GlassCard>
            )
          })}
        </div>
      ) : null}

      {/* Aggregate analysis */}
      {summary ? (
        <BatchAnalysisCard summary={summary} onReset={() => setItems([])} />
      ) : null}

      <style jsx>{`
        :global(.aguila-spin) {
          animation: aguila-spin 1s linear infinite;
        }
        @keyframes aguila-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.aguila-spin) { animation: none; }
        }
      `}</style>
    </>
  )
}

function ModeButton({
  active, onClick, icon, label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        minHeight: 60,
        padding: '0 20px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 10,
        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
        border: active ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
        color: active ? TEXT_PRIMARY : TEXT_SECONDARY,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background 160ms ease, color 160ms ease',
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
