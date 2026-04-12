'use client'

/**
 * V1 Polish Pack · Block 3 — DocUploader.
 *
 * Drag-drop zone (or click to pick). Each dropped file: POST
 * /api/docs/upload → POST /api/docs/classify → toast with the
 * detected type + confidence. PDFs and Anthropic errors surface as
 * a red "clasificar manualmente" toast — never silent success.
 *
 * Design: matches ClientHome glass system. Cyan hover border, big
 * 60px+ target, Inter for text, JetBrains Mono for confidence %.
 */

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, FileText, Loader2 } from 'lucide-react'
import {
  ACCENT_CYAN,
  BG_CARD,
  BORDER,
  GLASS_BLUR,
  GLOW_CYAN_SUBTLE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { useToast } from '@/components/Toast'
import { useTrack } from '@/lib/telemetry/useTrack'

interface DocUploaderProps {
  traficoId: string
  /** Optional hint for future wiring from Block 10 (ExpedienteChecklist). */
  defaultDocType?: string
  /** Fires once per successful upload+classify cycle. */
  onUploaded?: (result: { docId: string; type: string; confidence: number | null }) => void
}

interface UploadResponse {
  data: { docId: string; fileUrl: string; mimeType: string; fileName: string } | null
  error: { code: string; message: string } | null
}
interface ClassifyResponse {
  data: {
    documentId: string
    needsManual: boolean
    type: string
    confidence: number | null
  } | null
  error: { code: string; message: string } | null
}

const TYPE_LABELS_ES: Record<string, string> = {
  factura: 'Factura comercial',
  bill_of_lading: 'Conocimiento de embarque',
  packing_list: 'Lista de empaque',
  certificado_origen: 'Certificado de origen',
  carta_porte: 'Carta porte',
  pedimento: 'Pedimento',
  rfc_constancia: 'Constancia RFC',
  other: 'Otro documento',
  pending_manual: 'Clasificar manualmente',
  pending: 'Procesando',
}

function labelFor(type: string): string {
  return TYPE_LABELS_ES[type] ?? type.replace(/_/g, ' ')
}

export function DocUploader({ traficoId, defaultDocType, onUploaded }: DocUploaderProps) {
  const router = useRouter()
  const { toast } = useToast()
  const track = useTrack()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [busyCount, setBusyCount] = useState(0)

  const uploadOne = useCallback(
    async (file: File) => {
      setBusyCount((n) => n + 1)
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('trafico_id', traficoId)
        if (defaultDocType) fd.append('default_doc_type', defaultDocType)

        const uploadRes = await fetch('/api/docs/upload', { method: 'POST', body: fd })
        const uploadJson = (await uploadRes.json().catch(() => null)) as UploadResponse | null
        if (!uploadRes.ok || !uploadJson?.data) {
          const msg = uploadJson?.error?.message ?? `Error al subir ${file.name}`
          toast(msg, 'error')
          return
        }

        const { docId } = uploadJson.data
        track('doc_uploaded', { entityType: 'trafico', entityId: traficoId, metadata: { doc_id: docId, file_name: file.name } })

        const classifyRes = await fetch('/api/docs/classify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ documentId: docId }),
        })
        const classifyJson = (await classifyRes.json().catch(() => null)) as ClassifyResponse | null

        if (!classifyRes.ok || !classifyJson?.data) {
          const msg = classifyJson?.error?.message ?? 'Clasificación falló — marcar manualmente'
          toast(msg, 'error')
          router.refresh()
          return
        }

        const { type, confidence, needsManual } = classifyJson.data
        if (needsManual) {
          toast(`Subido ${file.name} — clasificar manualmente`, 'error')
        } else {
          const pct =
            typeof confidence === 'number' && Number.isFinite(confidence)
              ? Math.round(confidence * 100)
              : null
          const conf = pct === null ? '' : ` (${pct}%)`
          toast(`Documento subido: ${labelFor(type)}${conf}`, 'success')
          track('doc_autoclassified', {
            entityType: 'trafico',
            entityId: traficoId,
            metadata: { doc_id: docId, type, confidence: pct },
          })
        }
        onUploaded?.({ docId, type, confidence })
        router.refresh()
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error desconocido al subir', 'error')
      } finally {
        setBusyCount((n) => n - 1)
      }
    },
    [traficoId, defaultDocType, onUploaded, router, toast, track]
  )

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files)
      for (const f of list) void uploadOne(f)
    },
    [uploadOne]
  )

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setIsDragging(false), [])

  const onPick = useCallback(() => inputRef.current?.click(), [])

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) handleFiles(e.target.files)
      // Reset so the same file can be re-picked after a failed upload.
      e.target.value = ''
    },
    [handleFiles]
  )

  const borderColor = isDragging ? ACCENT_CYAN : BORDER
  const bg = isDragging ? `${BG_CARD}` : 'rgba(255,255,255,0.02)'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPick()
        }
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      aria-label="Arrastra documentos aquí o haz clic para seleccionar"
      style={{
        minHeight: 120,
        padding: 20,
        borderRadius: 16,
        border: `2px dashed ${borderColor}`,
        background: bg,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        cursor: 'pointer',
        transition: 'border-color 150ms ease, background 150ms ease, box-shadow 150ms ease',
        boxShadow: isDragging ? `0 0 0 1px ${ACCENT_CYAN}, 0 0 24px ${GLOW_CYAN_SUBTLE}` : 'none',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        multiple
        onChange={onInputChange}
        style={{ display: 'none' }}
      />
      {busyCount > 0 ? (
        <Loader2 size={24} style={{ color: ACCENT_CYAN, animation: 'spin 1.2s linear infinite' }} />
      ) : isDragging ? (
        <UploadCloud size={28} style={{ color: ACCENT_CYAN }} />
      ) : (
        <FileText size={24} style={{ color: TEXT_MUTED }} />
      )}

      <div style={{ fontSize: 14, color: TEXT_PRIMARY, fontWeight: 600 }}>
        {busyCount > 0 ? `Subiendo ${busyCount} archivo${busyCount === 1 ? '' : 's'}…` : 'Arrastra documentos aquí'}
      </div>
      <div style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'center' }}>
        PDF, JPG, PNG, WEBP · máximo 10 MB · clasificación automática
      </div>
      <div style={{ fontSize: 11, color: TEXT_MUTED }}>
        o haz clic para seleccionar
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
