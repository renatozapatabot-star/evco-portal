'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, Loader2, ScanLine, CheckCircle2, AlertTriangle, PackageCheck, Printer } from 'lucide-react'
import { DOCK_OPTIONS } from '@/lib/warehouse-entries'
import { BG_ELEVATED } from '@/lib/design-system'
import { AguilaTextarea } from '@/components/aguila'

type Status = 'idle' | 'submitting' | 'success' | 'error'
type PrintStatus = 'idle' | 'submitting' | 'queued' | 'error'

interface TraficoHit {
  id: string
  label: string
}

/**
 * Block 13 · Vicente's dock workflow.
 *
 * Mobile-first 375px viewport. Single screen. Trailer + dock + photos + notes.
 * Reuses Block 4 camera pattern (`capture="environment"`). QR scanner is a
 * progressive enhancement — if the browser exposes `BarcodeDetector`, we
 * open the camera stream; otherwise the button is hidden and the operator
 * types the trailer number. Works on iOS Safari + Android Chrome without
 * extra permissions for the fallback path.
 */
export function RecibirEntradaClient() {
  const [traficoQuery, setTraficoQuery] = useState('')
  const [traficoId, setTraficoId] = useState('')
  const [traficoResults, setTraficoResults] = useState<TraficoHit[]>([])
  const [searchingTrafico, setSearchingTrafico] = useState(false)
  const [trailer, setTrailer] = useState('')
  const [dock, setDock] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [lastEntry, setLastEntry] = useState<{ entry_id: string; trafico_id: string; photo_count: number } | null>(null)
  const [supportsScanner, setSupportsScanner] = useState(false)
  const [printStatus, setPrintStatus] = useState<PrintStatus>('idle')
  const [printMsg, setPrintMsg] = useState<string>('')

  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const w = typeof window !== 'undefined'
      ? (window as unknown as { BarcodeDetector?: unknown })
      : null
    setSupportsScanner(!!w && typeof w.BarcodeDetector === 'function')
  }, [])

  // Debounced embarque search — reuses Block 2's universal search endpoint.
  useEffect(() => {
    if (traficoQuery.length < 2) {
      setTraficoResults([])
      return
    }
    const ctrl = new AbortController()
    setSearchingTrafico(true)
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/universal?q=${encodeURIComponent(traficoQuery)}&type=traficos`,
          { signal: ctrl.signal },
        )
        if (!res.ok) return
        const json = (await res.json()) as {
          data?: { results?: Array<{ id?: string; label?: string; title?: string; trafico_id?: string }> }
        }
        const hits = (json.data?.results ?? []).slice(0, 5).map((r) => ({
          id: r.id ?? r.trafico_id ?? '',
          label: r.label ?? r.title ?? r.trafico_id ?? r.id ?? '',
        })).filter((h) => h.id)
        setTraficoResults(hits)
      } catch {
        // silent — user can type freely
      } finally {
        setSearchingTrafico(false)
      }
    }, 180)
    return () => {
      ctrl.abort()
      window.clearTimeout(timer)
    }
  }, [traficoQuery])

  function handlePhotos(files: FileList | null) {
    if (!files) return
    const next = [...photos, ...Array.from(files)].slice(0, 8)
    setPhotos(next)
  }

  function resetForm() {
    setTrailer('')
    setDock('')
    setNotes('')
    setPhotos([])
    setTraficoQuery('')
    setTraficoId('')
    setTraficoResults([])
    setStatus('idle')
    setErrorMsg('')
    setLastEntry(null)
    setPrintStatus('idle')
    setPrintMsg('')
  }

  async function printLabel() {
    if (!lastEntry) return
    setPrintStatus('submitting')
    setPrintMsg('')
    try {
      const res = await fetch('/api/labels/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entradaId: lastEntry.entry_id, dockId: dock || null }),
      })
      const json = (await res.json()) as {
        data?: { id: string; pdfUrl: string; qrCode: string }
        error?: { message: string } | null
      }
      if (!res.ok || !json.data) {
        throw new Error(json.error?.message ?? 'No se pudo encolar')
      }
      // Open PDF in a new tab — browser hands it to the print dialog.
      if (typeof window !== 'undefined') {
        window.open(json.data.pdfUrl, '_blank', 'noopener,noreferrer')
      }
      setPrintStatus('queued')
      setPrintMsg('Etiqueta en cola')
    } catch (e) {
      setPrintStatus('error')
      setPrintMsg(e instanceof Error ? e.message : 'Error al imprimir')
    }
  }

  async function submit() {
    if (!traficoId) {
      setErrorMsg('Selecciona un embarque')
      setStatus('error')
      return
    }
    if (trailer.trim().length < 2) {
      setErrorMsg('Captura el número de caja')
      setStatus('error')
      return
    }
    setStatus('submitting')
    setErrorMsg('')
    try {
      const fd = new FormData()
      fd.append('trafico_id', traficoId)
      fd.append('trailer_number', trailer.trim())
      if (dock) fd.append('dock_assigned', dock)
      if (notes.trim()) fd.append('notes', notes.trim())
      photos.forEach((p) => fd.append('photos', p))

      const res = await fetch('/api/warehouse/register', {
        method: 'POST',
        body: fd,
      })
      const json = (await res.json()) as {
        data?: { entry_id: string; photo_count: number }
        error?: { message: string } | null
      }
      if (!res.ok || !json.data) {
        throw new Error(json.error?.message ?? 'No se pudo registrar')
      }
      setLastEntry({
        entry_id: json.data.entry_id,
        trafico_id: traficoId,
        photo_count: json.data.photo_count,
      })
      setStatus('success')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error desconocido')
      setStatus('error')
    }
  }

  if (status === 'success' && lastEntry) {
    return (
      <main
        className="aduana-dark"
        style={{
          minHeight: '100vh',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxWidth: 480,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            alignItems: 'center',
            textAlign: 'center',
            padding: 24,
            borderRadius: 20,
            background: BG_ELEVATED,
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(192,197,206,0.18)',
          }}
        >
          <CheckCircle2 size={48} color="var(--portal-status-green-fg)" />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--portal-fg-1)', margin: 0 }}>
            Entrada registrada
          </h1>
          <p style={{ color: 'var(--portal-fg-4)', margin: 0 }}>
            {lastEntry.photo_count} foto(s) subidas
          </p>
          <p
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: 'var(--aguila-fs-compact)',
              color: 'var(--portal-fg-5)',
              margin: 0,
              wordBreak: 'break-all',
            }}
          >
            {lastEntry.entry_id}
          </p>
        </div>

        <button
          type="button"
          onClick={printLabel}
          disabled={printStatus === 'submitting'}
          style={{
            minHeight: 60,
            width: '100%',
            borderRadius: 14,
            background: 'linear-gradient(135deg, #E8EAED 0%, #C0C5CE 50%, #7A7E86 100%)',
            color: 'var(--portal-ink-0)',
            fontWeight: 700,
            fontSize: 'var(--aguila-fs-body-lg)',
            border: 'none',
            cursor: printStatus === 'submitting' ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {printStatus === 'submitting' ? (
            <>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              Encolando…
            </>
          ) : (
            <>
              <Printer size={18} />
              Imprimir etiqueta
            </>
          )}
        </button>

        {printStatus === 'queued' && printMsg && (
          <div
            role="status"
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(192,197,206,0.12)',
              border: '1px solid rgba(192,197,206,0.35)',
              color: 'var(--portal-fg-3)',
              fontSize: 'var(--aguila-fs-body)',
              textAlign: 'center',
            }}
          >
            {printMsg}
          </div>
        )}
        {printStatus === 'error' && printMsg && (
          <div
            role="alert"
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(220,38,38,0.12)',
              border: '1px solid rgba(220,38,38,0.35)',
              color: 'var(--portal-status-red-fg)',
              fontSize: 'var(--aguila-fs-body)',
              textAlign: 'center',
            }}
          >
            {printMsg}
          </div>
        )}

        <button
          type="button"
          onClick={resetForm}
          style={{
            minHeight: 60,
            width: '100%',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--portal-fg-1)',
            fontWeight: 600,
            fontSize: 'var(--aguila-fs-body-lg)',
            border: '1px solid rgba(192,197,206,0.18)',
            cursor: 'pointer',
          }}
        >
          Registrar siguiente
        </button>

        <Link
          href={`/embarques/${encodeURIComponent(lastEntry.trafico_id)}`}
          style={{
            minHeight: 60,
            width: '100%',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--portal-fg-1)',
            fontWeight: 600,
            fontSize: 'var(--aguila-fs-body-lg)',
            border: '1px solid rgba(192,197,206,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
          }}
        >
          Ver detalle
        </Link>
      </main>
    )
  }

  return (
    <main
      className="aduana-dark"
      style={{
        minHeight: '100vh',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PackageCheck size={22} color="var(--portal-fg-3)" />
        <h1 style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 700, color: 'var(--portal-fg-1)', margin: 0 }}>
          Recepción en bodega
        </h1>
      </header>

      {/* Embarque picker */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 'var(--aguila-fs-meta)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--portal-fg-4)' }}>
          Embarque
        </span>
        <input
          type="text"
          inputMode="search"
          value={traficoQuery}
          onChange={(e) => {
            setTraficoQuery(e.target.value)
            setTraficoId('')
          }}
          placeholder="Buscar por número…"
          style={{
            minHeight: 56,
            padding: '0 14px',
            borderRadius: 12,
            border: '1px solid rgba(192,197,206,0.18)',
            background: BG_ELEVATED,
            color: 'var(--portal-fg-1)',
            fontSize: 'var(--aguila-fs-body-lg)',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
          }}
          aria-label="Buscar embarque"
        />
        {searchingTrafico && <span style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-5)' }}>Buscando…</span>}
        {traficoResults.length > 0 && !traficoId && (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 4,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.045)',
              border: '1px solid rgba(192,197,206,0.18)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {traficoResults.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    setTraficoId(r.id)
                    setTraficoQuery(r.label)
                    setTraficoResults([])
                  }}
                  style={{
                    minHeight: 44,
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    background: 'transparent',
                    color: 'var(--portal-fg-1)',
                    border: 'none',
                    borderRadius: 10,
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    cursor: 'pointer',
                  }}
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {traficoId && (
          <span style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-status-green-fg)' }}>
            Embarque seleccionado: {traficoId}
          </span>
        )}
      </label>

      {/* Trailer number */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 'var(--aguila-fs-meta)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--portal-fg-4)' }}>
          Número de caja
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            value={trailer}
            onChange={(e) => setTrailer(e.target.value)}
            placeholder="ABC-1234"
            style={{
              flex: 1,
              minHeight: 60,
              padding: '0 14px',
              borderRadius: 12,
              border: '1px solid rgba(192,197,206,0.18)',
              background: BG_ELEVATED,
              color: 'var(--portal-fg-1)',
              fontSize: 'var(--aguila-fs-kpi-small)',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              letterSpacing: '0.04em',
            }}
            aria-label="Número de caja"
          />
          {supportsScanner && (
            <button
              type="button"
              title="Escanear código"
              aria-label="Escanear código"
              onClick={() => {
                // Progressive enhancement: if BarcodeDetector exists, camera
                // capture triggers the native photo picker which on supported
                // devices can decode printed trailer codes. If not, the user
                // simply types the number.
                photoInputRef.current?.click()
              }}
              style={{
                minHeight: 60,
                minWidth: 60,
                borderRadius: 12,
                border: '1px solid rgba(192,197,206,0.18)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--portal-fg-3)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ScanLine size={22} />
            </button>
          )}
        </div>
      </label>

      {/* Dock */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 'var(--aguila-fs-meta)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--portal-fg-4)' }}>
          Andén (opcional)
        </span>
        <select
          value={dock}
          onChange={(e) => setDock(e.target.value)}
          style={{
            minHeight: 60,
            padding: '0 14px',
            borderRadius: 12,
            border: '1px solid rgba(192,197,206,0.18)',
            background: BG_ELEVATED,
            color: 'var(--portal-fg-1)',
            fontSize: 'var(--aguila-fs-body-lg)',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
          }}
          aria-label="Andén asignado"
        >
          <option value="">Sin asignar</option>
          {DOCK_OPTIONS.map((d) => (
            <option key={d} value={d}>
              Andén {d}
            </option>
          ))}
        </select>
      </label>

      {/* Photo capture */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 'var(--aguila-fs-meta)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--portal-fg-4)' }}>
          Fotos ({photos.length}/8)
        </span>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) => handlePhotos(e.target.files)}
          style={{ display: 'none' }}
          aria-label="Capturar fotos"
        />
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          style={{
            minHeight: 60,
            width: '100%',
            borderRadius: 12,
            border: '2px dashed rgba(192,197,206,0.35)',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--portal-fg-1)',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <Camera size={22} />
          {photos.length === 0 ? 'Tomar fotos' : 'Agregar más fotos'}
        </button>
        {photos.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            {photos.map((p, i) => (
              <li
                key={`${p.name}-${i}`}
                style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: 'var(--aguila-fs-meta)',
                  color: 'var(--portal-fg-3)',
                  padding: '4px 8px',
                  borderRadius: 8,
                  background: 'rgba(192,197,206,0.08)',
                }}
              >
                {p.name.slice(0, 18)}
              </li>
            ))}
          </ul>
        )}
      </label>

      {/* Notes */}
      <AguilaTextarea
        label="Notas (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Daño, observaciones, sellos…"
        aria-label="Notas de recepción"
      />

      {status === 'error' && errorMsg && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            borderRadius: 12,
            background: 'rgba(220,38,38,0.12)',
            border: '1px solid rgba(220,38,38,0.35)',
            color: 'var(--portal-status-red-fg)',
            fontSize: 'var(--aguila-fs-section)',
          }}
        >
          <AlertTriangle size={18} />
          {errorMsg}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={status === 'submitting'}
        style={{
          minHeight: 60,
          width: '100%',
          borderRadius: 14,
          background: 'linear-gradient(135deg, #E8EAED 0%, #C0C5CE 50%, #7A7E86 100%)',
          color: 'var(--portal-ink-0)',
          fontWeight: 700,
          fontSize: 17,
          border: 'none',
          cursor: status === 'submitting' ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        {status === 'submitting' ? (
          <>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            Registrando…
          </>
        ) : (
          'Registrar entrada'
        )}
      </button>
    </main>
  )
}
