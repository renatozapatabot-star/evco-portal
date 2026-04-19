'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TEXT_PRIMARY, TEXT_MUTED, ACCENT_SILVER, SILVER_GRADIENT } from '@/lib/design-system'

interface Props {
  certId: string
  canApprove: boolean
  status: 'draft' | 'approved' | 'superseded'
}

const CANCEL_WINDOW_SECONDS = 5

export function ApproveActions({ certId, canApprove, status }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<'idle' | 'countdown' | 'submitting'>('idle')
  const [remaining, setRemaining] = useState(CANCEL_WINDOW_SECONDS)
  const [err, setErr] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  async function runApproval() {
    if (cancelledRef.current) return
    setPhase('submitting')
    try {
      const res = await fetch(`/api/usmca/certificates/${certId}/approve`, { method: 'POST' })
      const json = await res.json() as { data: unknown; error: { message: string } | null }
      if (!res.ok || !json.data) {
        setErr(json.error?.message ?? 'No se pudo firmar el certificado')
        setPhase('idle')
        return
      }
      router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setPhase('idle')
    }
  }

  function startCountdown() {
    setErr(null)
    cancelledRef.current = false
    setRemaining(CANCEL_WINDOW_SECONDS)
    setPhase('countdown')
    timerRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          runApproval()
          return 0
        }
        return r - 1
      })
    }, 1000)
  }

  function cancelCountdown() {
    cancelledRef.current = true
    if (timerRef.current) clearInterval(timerRef.current)
    setPhase('idle')
    setRemaining(CANCEL_WINDOW_SECONDS)
  }

  const pdfHref = `/api/usmca/certificates/${certId}/pdf`

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a
          href={pdfHref}
          target="_blank"
          rel="noopener"
          style={{
            display: 'inline-flex', alignItems: 'center',
            minHeight: 60, padding: '0 24px',
            background: 'rgba(255,255,255,0.06)', color: TEXT_PRIMARY,
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, fontSize: 'var(--aguila-fs-section)', fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {status === 'approved' ? 'Descargar PDF firmado' : 'Ver PDF borrador'}
        </a>

        {canApprove && phase === 'idle' && (
          <button
            type="button"
            onClick={startCountdown}
            style={{
              minHeight: 60, padding: '0 28px',
              background: SILVER_GRADIENT, color: '#0A0A0C',
              border: 'none', borderRadius: 10,
              fontSize: 'var(--aguila-fs-section)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.5,
              cursor: 'pointer',
            }}
          >
            Firmar certificado
          </button>
        )}

        {canApprove && phase === 'countdown' && (
          <button
            type="button"
            onClick={cancelCountdown}
            style={{
              minHeight: 60, padding: '0 24px',
              background: 'var(--portal-status-red-bg)',
              color: 'var(--portal-status-red-fg)',
              border: '1px solid var(--portal-status-red-ring)',
              borderRadius: 10, fontSize: 'var(--aguila-fs-section)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.5,
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 10,
            }}
          >
            <span>Cancelar</span>
            <span style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontVariantNumeric: 'tabular-nums',
              background: 'rgba(239,68,68,0.18)',
              padding: '2px 8px', borderRadius: 6,
            }}>{remaining}s</span>
          </button>
        )}

        {phase === 'submitting' && (
          <div style={{
            minHeight: 60, padding: '0 24px',
            display: 'inline-flex', alignItems: 'center',
            color: ACCENT_SILVER, fontSize: 'var(--aguila-fs-body)',
          }}>Firmando…</div>
        )}
      </div>

      {phase === 'countdown' && (
        <p style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_MUTED, margin: 0 }}>
          Tienes {CANCEL_WINDOW_SECONDS} segundos para cancelar antes de firmar.
          Al firmar, el certificado se adjunta al expediente y queda en el archivo
          retención de 5 años.
        </p>
      )}

      {err && (
        <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-status-red-fg)', margin: 0 }}>{err}</p>
      )}
    </div>
  )
}
