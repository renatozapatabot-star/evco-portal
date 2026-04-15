'use client'

/**
 * ZAPATA AI · V1.5 F17 — Pedimento PDF live preview rail.
 *
 * Right-rail tab that fetches /api/pedimento/[id]/preview and renders the
 * returned PDF bytes inline via a blob URL iframe. Refresh is debounced to
 * 2 seconds and triggered by `validationErrors` changing (each autosave
 * cycle flips validation state, which is our proxy for "form state dirty").
 *
 * Browser-native PDF viewer is used (iframe on object URL) — this keeps
 * the bundle small (no pdf.js worker ship) while satisfying the demo
 * moment: operator types → 2s later the preview repaints.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePedimento } from './PedimentoContext'

const PANEL_STYLE: React.CSSProperties = {
  padding: 16,
  borderRadius: 20,
  background: 'rgba(255,255,255,0.045)',
  border: '1px solid rgba(192,197,206,0.18)',
  backdropFilter: 'blur(20px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--aguila-fs-label)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

const DEBOUNCE_MS = 2000

export function PdfPreviewRail() {
  const { pedimentoId, validationErrors, errorsCount, warningsCount } = usePedimento()
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const lastBlobRef = useRef<string | null>(null)

  // Depend on validation snapshot as a proxy for form-dirty — each autosave
  // cycle flips these, which is precisely when the preview should refresh.
  const dirtyKey = useMemo(
    () => `${validationErrors.length}:${errorsCount}:${warningsCount}`,
    [validationErrors, errorsCount, warningsCount],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortRef.current) abortRef.current.abort()
      if (lastBlobRef.current) URL.revokeObjectURL(lastBlobRef.current)
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/pedimento/${pedimentoId}/preview`, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!res.ok) {
          let msg = `HTTP ${res.status}`
          try {
            const body = (await res.json()) as { error?: { message?: string } }
            if (body.error?.message) msg = body.error.message
          } catch { /* non-json body */ }
          throw new Error(msg)
        }
        const buf = await res.arrayBuffer()
        if (!mountedRef.current) return
        const blob = new Blob([buf], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        if (lastBlobRef.current) URL.revokeObjectURL(lastBlobRef.current)
        lastBlobRef.current = url
        setBlobUrl(url)
        setGeneratedAt(new Date())
        setLoading(false)
      } catch (err) {
        if (!mountedRef.current) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Error desconocido')
        setLoading(false)
      }
    }

    // Initial fetch: immediate. Subsequent (dirtyKey changes): 2s debounce.
    if (!blobUrl && !error) {
      void run()
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void run()
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedimentoId, dirtyKey])

  return (
    <div style={PANEL_STYLE} aria-label="Vista previa del pedimento (PDF)">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span style={LABEL_STYLE}>Vista previa PDF</span>
        <span
          style={{
            fontSize: 'var(--aguila-fs-label)',
            color: loading ? '#C0C5CE' : 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {loading
            ? 'regenerando…'
            : generatedAt
              ? generatedAt.toLocaleTimeString('es-MX', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : ''}
        </span>
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '60vh',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'rgba(192,197,206,0.04)',
          border: '1px solid rgba(192,197,206,0.14)',
        }}
      >
        {loading && !blobUrl ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--aguila-fs-compact)',
              color: '#C0C5CE',
              background:
                'linear-gradient(135deg, rgba(192,197,206,0.08), rgba(192,197,206,0.02))',
            }}
            aria-busy="true"
          >
            Generando vista previa…
          </div>
        ) : error ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              textAlign: 'center',
              fontSize: 'var(--aguila-fs-compact)',
              color: '#C0C5CE',
            }}
          >
            No se pudo generar vista previa — corrige errores
            <br />
            <span style={{ fontSize: 'var(--aguila-fs-label)', color: 'var(--text-muted)', marginTop: 6 }}>
              {error}
            </span>
          </div>
        ) : blobUrl ? (
          <iframe
            key={blobUrl}
            src={blobUrl}
            title="Vista previa del pedimento"
            style={{
              width: '100%',
              height: '60vh',
              border: 'none',
              background: '#ffffff',
            }}
          />
        ) : null}

        {loading && blobUrl ? (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(192,197,206,0.18)',
              color: '#E8EAED',
              fontSize: 'var(--aguila-fs-label)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Actualizando…
          </div>
        ) : null}
      </div>

      <p
        style={{
          fontSize: 'var(--aguila-fs-label)',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}
      >
        La vista previa se regenera 2 segundos después de cada autoguardado.
        No persiste archivos — úsala para validar visualmente antes de exportar.
      </p>
    </div>
  )
}
