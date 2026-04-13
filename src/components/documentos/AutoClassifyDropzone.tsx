'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, CheckCircle, AlertTriangle, XCircle, Loader2, Link2 } from 'lucide-react'
import { GlassCard } from '@/components/aguila'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
  GREEN, AMBER, RED, BORDER_HAIRLINE,
} from '@/lib/design-system'

type ItemStatus = 'uploading' | 'classifying' | 'ready' | 'review' | 'missing' | 'error'

interface DropItem {
  localId: string
  fileName: string
  sizeBytes: number
  status: ItemStatus
  typeLabel?: string
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

export function AutoClassifyDropzone() {
  const [items, setItems] = useState<DropItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    if (!ACCEPTED_MIME.includes(file.type)) {
      setItems((prev) => [...prev, {
        localId, fileName: file.name, sizeBytes: file.size,
        status: 'error', errorMessage: 'Solo PDF, JPG o PNG',
      }])
      return
    }
    if (file.size > MAX_SIZE) {
      setItems((prev) => [...prev, {
        localId, fileName: file.name, sizeBytes: file.size,
        status: 'error', errorMessage: 'Archivo excede 10 MB',
      }])
      return
    }

    setItems((prev) => [...prev, {
      localId, fileName: file.name, sizeBytes: file.size, status: 'uploading',
    }])

    let docId: string | null = null
    try {
      const fd = new FormData()
      fd.append('file', file)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
      const uploadJson = await uploadRes.json()
      if (!uploadRes.ok || uploadJson.error) {
        throw new Error(uploadJson.error?.message ?? 'Error al subir')
      }
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
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Error al clasificar')
      }
      const d = json.data as {
        status: 'ready' | 'review' | 'missing'
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
  }, [])

  const onFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    Array.from(files).forEach((f) => { void processFile(f) })
  }, [processFile])

  return (
    <>
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
          aria-label="Arrastra o elige un documento para clasificar"
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
          <div style={{
            marginTop: 12,
            color: TEXT_PRIMARY,
            fontSize: 16,
            fontWeight: 600,
          }}>
            Arrastra un documento aquí
          </div>
          <div style={{ marginTop: 4, color: TEXT_MUTED, fontSize: 13 }}>
            o toca para elegir un archivo · PDF, JPG o PNG · 10 MB máx.
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
            Elegir archivo
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
                      <span style={{ color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600, wordBreak: 'break-all' }}>
                        {it.fileName}
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
                          Enlazado al tráfico{' '}
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
