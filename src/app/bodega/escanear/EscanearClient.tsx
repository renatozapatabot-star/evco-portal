'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, ScanLine, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { AguilaMark } from '@/components/brand/AguilaMark'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  ACCENT_SILVER_DIM,
  BG_DEEP,
  BG_ELEVATED,
} from '@/lib/design-system'
import { trackClick } from '@/lib/telemetry'

type Status = 'idle' | 'scanning' | 'resolving' | 'success' | 'error'

interface ResolvedTrafico {
  ref: string
  cliente: string | null
  traficoId: string
}

/**
 * Uses the browser's native BarcodeDetector where available (Android Chrome,
 * recent iOS Safari). Falls back to the html5-qrcode library on older browsers
 * — loaded dynamically so the mobile bundle stays small. Manual entry always
 * works.
 */
export function EscanearClient() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('idle')
  const [manualCode, setManualCode] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [resolved, setResolved] = useState<ResolvedTrafico | null>(null)
  const [supportsNative, setSupportsNative] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fallbackScannerRef = useRef<{ stop: () => Promise<void> } | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const w = typeof window !== 'undefined'
      ? (window as unknown as { BarcodeDetector?: unknown })
      : null
    setSupportsNative(!!w && typeof w.BarcodeDetector === 'function')
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  function stopCamera() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }
    if (fallbackScannerRef.current) {
      void fallbackScannerRef.current.stop().catch(() => {})
      fallbackScannerRef.current = null
    }
  }

  async function startScan() {
    setErrorMsg('')
    setResolved(null)
    trackClick('qr_scan_started', { mode: supportsNative ? 'native' : 'fallback' })

    if (supportsNative) {
      await startNativeScan()
    } else {
      await startFallbackScan()
    }
  }

  async function startNativeScan() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      setStatus('scanning')

      // BarcodeDetector — constructor is sniffed via the window cast above.
      const DetectorCtor = (window as unknown as {
        BarcodeDetector: new (opts: { formats: string[] }) => {
          detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>
        }
      }).BarcodeDetector
      const detector = new DetectorCtor({ formats: ['qr_code'] })

      const loop = async () => {
        if (!videoRef.current || status === 'resolving') return
        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            const raw = barcodes[0].rawValue
            stopCamera()
            await resolveCode(raw)
            return
          }
        } catch {
          // ignore detect errors; keep scanning
        }
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      setStatus('error')
      setErrorMsg(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Ingrese el código manualmente.'
          : 'No se pudo abrir la cámara. Ingrese el código manualmente.',
      )
    }
  }

  async function startFallbackScan() {
    try {
      const mod = await import('html5-qrcode')
      const { Html5Qrcode } = mod
      const elId = 'aguila-qr-fallback'
      const scanner = new Html5Qrcode(elId)
      fallbackScannerRef.current = scanner
      setStatus('scanning')
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 240 },
        async (decoded) => {
          if (status === 'resolving') return
          await scanner.stop().catch(() => {})
          fallbackScannerRef.current = null
          await resolveCode(decoded)
        },
        () => {
          // silent per-frame failures
        },
      )
    } catch (err) {
      setStatus('error')
      setErrorMsg('No se pudo iniciar el escáner. Ingrese el código manualmente.')
      console.error('[escanear] fallback scan failed:', err instanceof Error ? err.message : String(err))
    }
  }

  async function resolveCode(rawCode: string) {
    setStatus('resolving')
    setErrorMsg('')
    try {
      const res = await fetch('/api/qr/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: rawCode, location: 'bodega-escaner' }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setStatus('error')
        setErrorMsg(json.error?.message ?? 'No se pudo resolver el código.')
        trackClick('qr_scan_failed', { code: rawCode.slice(0, 12) })
        return
      }
      const data = json.data as {
        traficoId: string
        trafico: { ref: string; cliente: string | null }
      }
      setResolved({
        ref: data.trafico.ref,
        cliente: data.trafico.cliente,
        traficoId: data.traficoId,
      })
      setStatus('success')
      trackClick('qr_scan_resolved', { trafico_id: data.traficoId })
      window.setTimeout(() => {
        router.push(`/embarques/${encodeURIComponent(data.traficoId)}`)
      }, 1200)
    } catch (err) {
      setStatus('error')
      setErrorMsg('Error de conexión. Intente de nuevo.')
      console.error('[escanear] resolve failed:', err instanceof Error ? err.message : String(err))
    }
  }

  async function handleManualSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const code = manualCode.trim()
    if (!code) return
    await resolveCode(code)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG_DEEP,
        color: ACCENT_SILVER_BRIGHT,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 20, marginTop: 8 }}>
          <AguilaMark size={40} tone="silver" aria-label="CRUZ" />
          <div
            style={{
              fontSize: 'var(--aguila-fs-meta)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: ACCENT_SILVER_DIM,
              marginTop: 8,
            }}
          >
            Bodega · Escanear QR
          </div>
        </div>

        <div
          style={{
            borderRadius: 20,
            padding: 20,
            background: BG_ELEVATED,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          }}
        >
          {status === 'idle' && (
            <>
              <p style={{ fontSize: 'var(--aguila-fs-section)', color: ACCENT_SILVER, lineHeight: 1.55, margin: 0 }}>
                Apunte la cámara a la etiqueta del remolque. Al leer el código, la entrada
                queda registrada y el embarque se abre automáticamente.
              </p>
              <button
                type="button"
                onClick={startScan}
                style={{
                  marginTop: 16,
                  width: '100%',
                  minHeight: 60,
                  padding: '14px 18px',
                  borderRadius: 14,
                  border: `1px solid ${ACCENT_SILVER}`,
                  background: 'linear-gradient(135deg, #E8EAED 0%, #C0C5CE 50%, #7A7E86 100%)',
                  color: BG_DEEP,
                  fontSize: 'var(--aguila-fs-body-lg)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  cursor: 'pointer',
                }}
              >
                <Camera size={20} aria-hidden /> Escanear QR
              </button>
            </>
          )}

          {status === 'scanning' && (
            <div>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: 14,
                  overflow: 'hidden',
                  background: '#000',
                  border: `1px solid ${ACCENT_SILVER_DIM}`,
                }}
              >
                {supportsNative ? (
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div id="aguila-qr-fallback" style={{ width: '100%', height: '100%' }} />
                )}
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: '15%',
                    border: `2px solid ${ACCENT_SILVER_BRIGHT}`,
                    borderRadius: 12,
                    pointerEvents: 'none',
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: ACCENT_SILVER,
                  fontSize: 'var(--aguila-fs-body)',
                }}
              >
                <ScanLine size={16} aria-hidden /> Buscando código…
              </div>
              <button
                type="button"
                onClick={() => { stopCamera(); setStatus('idle') }}
                style={{
                  marginTop: 12,
                  width: '100%',
                  minHeight: 44,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${ACCENT_SILVER_DIM}`,
                  background: 'transparent',
                  color: ACCENT_SILVER,
                  fontSize: 'var(--aguila-fs-section)',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          )}

          {status === 'resolving' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: ACCENT_SILVER }}>
              <Loader2 size={18} className="aguila-spin" aria-hidden />
              <span>Resolviendo código…</span>
            </div>
          )}

          {status === 'success' && resolved && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--portal-status-green-fg)' }}>
                <CheckCircle2 size={20} aria-hidden />
                <span style={{ fontSize: 15, fontWeight: 600 }}>Recepción registrada</span>
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                  fontSize: 15,
                  color: ACCENT_SILVER_BRIGHT,
                }}
              >
                {resolved.ref}
              </div>
              {resolved.cliente && (
                <div style={{ fontSize: 'var(--aguila-fs-body)', color: ACCENT_SILVER_DIM, marginTop: 2 }}>
                  {resolved.cliente}
                </div>
              )}
              <div style={{ fontSize: 'var(--aguila-fs-compact)', color: ACCENT_SILVER_DIM, marginTop: 10 }}>
                Abriendo embarque…
              </div>
            </div>
          )}

          {status === 'error' && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.35)',
                color: '#FCA5A5',
                fontSize: 'var(--aguila-fs-body)',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangle size={16} aria-hidden style={{ marginTop: 2 }} />
              <span>{errorMsg || 'Algo falló. Intente de nuevo.'}</span>
            </div>
          )}
        </div>

        {/* Manual fallback — always visible, permanent accessibility path */}
        <form
          onSubmit={handleManualSubmit}
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 20,
            background: BG_ELEVATED,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <label
            htmlFor="manual-code"
            style={{
              fontSize: 'var(--aguila-fs-meta)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: ACCENT_SILVER_DIM,
            }}
          >
            Ingresar código manualmente
          </label>
          <input
            id="manual-code"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder="XK9P2QR7MN"
            style={{
              width: '100%',
              marginTop: 8,
              minHeight: 60,
              padding: '14px 16px',
              borderRadius: 12,
              border: `1px solid ${ACCENT_SILVER_DIM}`,
              background: 'rgba(0,0,0,0.4)',
              color: ACCENT_SILVER_BRIGHT,
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              fontSize: 'var(--aguila-fs-kpi-small)',
              letterSpacing: '0.12em',
            }}
          />
          <button
            type="submit"
            disabled={!manualCode.trim() || status === 'resolving'}
            style={{
              marginTop: 12,
              width: '100%',
              minHeight: 60,
              padding: '14px 18px',
              borderRadius: 14,
              border: `1px solid ${ACCENT_SILVER}`,
              background: 'transparent',
              color: ACCENT_SILVER_BRIGHT,
              fontSize: 15,
              fontWeight: 600,
              cursor: manualCode.trim() ? 'pointer' : 'not-allowed',
              opacity: manualCode.trim() ? 1 : 0.5,
            }}
          >
            Resolver código
          </button>
        </form>
      </div>

      <style>{`
        .aguila-spin { animation: aguila-spin 1s linear infinite; }
        @keyframes aguila-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
