'use client'

import { useState, useRef } from 'react'
import { Camera, Upload, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { useToast } from '@/components/Toast'

interface PhotoUploadProps {
  traficoId?: string
  onClassified?: (result: { document_type: string; confidence: number; fields: Record<string, string> }) => void
}

/**
 * Mobile photo upload — capture from camera or gallery → OCR classify → attach.
 * One-tap workflow: snap → classify → done.
 */
export function PhotoUpload({ traficoId, onClassified }: PhotoUploadProps) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'classifying' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ document_type: string; confidence: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  async function handleFile(file: File) {
    if (!file) return

    setStatus('uploading')
    setErrorMsg('')

    try {
      // Send to OCR classify endpoint
      const formData = new FormData()
      formData.append('file', file)
      if (traficoId) formData.append('trafico_id', traficoId)

      setStatus('classifying')
      const res = await fetch('/api/ocr-classify', { method: 'POST', body: formData })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error de clasificación')
      }

      const data = await res.json()
      setResult({ document_type: data.document_type, confidence: data.confidence })
      setStatus('done')
      toast(`Documento clasificado: ${data.document_type} (${data.confidence}%)`, 'success')

      if (onClassified) onClassified(data)

      // Reset after 3 seconds
      setTimeout(() => { setStatus('idle'); setResult(null) }, 3000)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error desconocido')
      setStatus('error')
      toast('Error al clasificar documento', 'error')
      setTimeout(() => { setStatus('idle'); setErrorMsg('') }, 3000)
    }
  }

  const docTypeLabels: Record<string, string> = {
    factura_comercial: 'Factura Comercial',
    lista_empaque: 'Lista de Empaque',
    conocimiento_embarque: 'Bill of Lading',
    certificado_origen: 'Certificado de Origen',
    carta_porte: 'Carta Porte',
    manifestacion_valor: 'COVE',
    pedimento: 'Pedimento',
    otro: 'Otro documento',
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        capture="environment"
        onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
        style={{ display: 'none' }}
        aria-label="Subir foto de documento"
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={status === 'uploading' || status === 'classifying'}
        className="spring-press"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          width: '100%', padding: '14px 20px', minHeight: 60,
          borderRadius: 14,
          border: status === 'done' ? '2px solid var(--success)' : status === 'error' ? '2px solid var(--danger-500)' : '2px dashed var(--border)',
          background: status === 'done' ? 'rgba(22,163,74,0.06)' : status === 'error' ? 'rgba(220,38,38,0.06)' : 'var(--bg-main)',
          color: status === 'done' ? 'var(--success)' : status === 'error' ? 'var(--danger-500)' : 'var(--text-secondary)',
          cursor: status === 'uploading' || status === 'classifying' ? 'wait' : 'pointer',
          fontSize: 14, fontWeight: 600,
          transition: 'all 200ms ease',
        }}
      >
        {status === 'idle' && (
          <>
            <Camera size={20} />
            <span>Foto de documento</span>
          </>
        )}
        {status === 'uploading' && (
          <>
            <Upload size={20} className="animate-pulse" />
            <span>Subiendo...</span>
          </>
        )}
        {status === 'classifying' && (
          <>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Clasificando con CRUZ AI...</span>
          </>
        )}
        {status === 'done' && result && (
          <>
            <Check size={20} />
            <span>{docTypeLabels[result.document_type] || result.document_type} ({result.confidence}%)</span>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertTriangle size={20} />
            <span>{errorMsg || 'Error'}</span>
          </>
        )}
      </button>
    </div>
  )
}
