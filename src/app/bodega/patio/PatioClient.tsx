'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  LogOut,
  ParkingSquare,
  Snowflake,
  X,
} from 'lucide-react'
import {
  GRID_COLUMNS,
  GRID_ROWS,
  formatPosition,
  moveCell,
  parsePosition,
  waitBucketFromDates,
  type ArrowKey,
  type GridCell,
  type WaitBucket,
} from '@/lib/yard-entries'
import { BG_ELEVATED } from '@/lib/design-system'

type Status = 'idle' | 'submitting' | 'success' | 'error'

interface YardEntry {
  id: string
  trafico_id: string
  company_id: string
  trailer_number: string
  yard_position: string
  refrigerated: boolean
  temperature_setting: number | null
  entered_at: string
  exited_at: string | null
  created_by: string
}

interface TraficoHit {
  id: string
  label: string
}

// ── Color tokens per wait bucket ─────────────────────────────────────────────
const BUCKET_BORDER: Record<WaitBucket, string> = {
  silver: 'rgba(192,197,206,0.45)',
  gold: 'rgba(251,191,36,0.55)',
  red: 'rgba(239,68,68,0.6)',
}
const BUCKET_GLOW: Record<WaitBucket, string> = {
  silver: '0 0 18px rgba(192,197,206,0.18)',
  gold: '0 0 18px var(--portal-status-amber-ring)',
  red: '0 0 20px rgba(239,68,68,0.35)',
}
const BUCKET_LABEL: Record<WaitBucket, string> = {
  silver: '< 2h',
  gold: '2–6h',
  red: '> 6h',
}

function formatElapsed(enteredAt: string, now: Date): string {
  const ms = now.getTime() - new Date(enteredAt).getTime()
  const mins = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

export function PatioClient() {
  const [entries, setEntries] = useState<YardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState<Date>(() => new Date())

  // Form state
  const [traficoQuery, setTraficoQuery] = useState('')
  const [traficoId, setTraficoId] = useState('')
  const [traficoResults, setTraficoResults] = useState<TraficoHit[]>([])
  const [searchingTrafico, setSearchingTrafico] = useState(false)
  const [trailer, setTrailer] = useState('')
  const [position, setPosition] = useState('')
  const [refrigerated, setRefrigerated] = useState(false)
  const [temperature, setTemperature] = useState<string>('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Grid picker
  const [gridOpen, setGridOpen] = useState(false)
  const [gridFocus, setGridFocus] = useState<GridCell>({ col: 'A', row: 1 })
  const gridRef = useRef<HTMLDivElement>(null)

  // Exit confirmation
  const [confirmExit, setConfirmExit] = useState<YardEntry | null>(null)

  // Refresh clock every 60s for waiting-time recolor.
  useEffect(() => {
    const h = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(h)
  }, [])

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/yard/entries', { cache: 'no-store' })
      const json = (await res.json()) as {
        data?: { entries: YardEntry[] }
        error?: { message: string } | null
      }
      if (res.ok && json.data) {
        setEntries(json.data.entries)
      }
    } catch {
      // silent — list will show empty state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  // Debounced embarque search.
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
        const hits = (json.data?.results ?? [])
          .slice(0, 5)
          .map((r) => ({
            id: r.id ?? r.trafico_id ?? '',
            label: r.label ?? r.title ?? r.trafico_id ?? r.id ?? '',
          }))
          .filter((h) => h.id)
        setTraficoResults(hits)
      } catch {
        // silent
      } finally {
        setSearchingTrafico(false)
      }
    }, 180)
    return () => {
      ctrl.abort()
      window.clearTimeout(timer)
    }
  }, [traficoQuery])

  const occupiedSet = useMemo(
    () => new Set(entries.map((e) => e.yard_position)),
    [entries],
  )

  const entryByPosition = useMemo(() => {
    const m = new Map<string, YardEntry>()
    for (const e of entries) m.set(e.yard_position, e)
    return m
  }, [entries])

  // Grid keyboard navigation.
  const onGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!gridOpen) return
      const arrows: ArrowKey[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
      if (arrows.includes(e.key as ArrowKey)) {
        e.preventDefault()
        setGridFocus((c) => moveCell(c, e.key as ArrowKey))
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const p = formatPosition(gridFocus)
        if (!occupiedSet.has(p)) {
          setPosition(p)
          setGridOpen(false)
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setGridOpen(false)
      }
    },
    [gridOpen, gridFocus, occupiedSet],
  )

  useEffect(() => {
    if (gridOpen) gridRef.current?.focus()
  }, [gridOpen])

  function resetForm() {
    setTraficoQuery('')
    setTraficoId('')
    setTraficoResults([])
    setTrailer('')
    setPosition('')
    setRefrigerated(false)
    setTemperature('')
    setStatus('idle')
    setErrorMsg('')
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
    const cell = parsePosition(position)
    if (!cell) {
      setErrorMsg('Posición inválida — usa A1 a Z9')
      setStatus('error')
      return
    }
    let temperature_setting: number | null = null
    if (refrigerated) {
      const t = Number.parseFloat(temperature)
      if (Number.isNaN(t)) {
        setErrorMsg('Captura la temperatura (°C)')
        setStatus('error')
        return
      }
      temperature_setting = t
    }

    setStatus('submitting')
    setErrorMsg('')
    try {
      const res = await fetch('/api/yard/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trafico_id: traficoId,
          trailer_number: trailer.trim(),
          yard_position: formatPosition(cell),
          refrigerated,
          temperature_setting,
        }),
      })
      const json = (await res.json()) as {
        data?: { entry_id: string }
        error?: { message: string } | null
      }
      if (!res.ok || !json.data) {
        throw new Error(json.error?.message ?? 'No se pudo registrar')
      }
      setStatus('success')
      resetForm()
      await loadEntries()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error desconocido')
      setStatus('error')
    }
  }

  async function markExit(entry: YardEntry) {
    try {
      const res = await fetch(
        `/api/yard/entries/${encodeURIComponent(entry.id)}/exit`,
        { method: 'PATCH' },
      )
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as
          | { error?: { message: string } }
          | null
        throw new Error(json?.error?.message ?? 'No se pudo registrar salida')
      }
      setConfirmExit(null)
      await loadEntries()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error desconocido')
      setStatus('error')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main
      className="aduana-dark"
      style={{
        minHeight: '100vh',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ParkingSquare size={22} color="var(--portal-fg-3)" />
        <h1 style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 700, color: 'var(--portal-fg-1)', margin: 0 }}>
          Patio
        </h1>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-5)', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
          {entries.length} activas
        </span>
      </header>

      {/* Color legend */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          fontSize: 'var(--aguila-fs-meta)',
          color: 'var(--portal-fg-4)',
          flexWrap: 'wrap',
        }}
      >
        {(['silver', 'gold', 'red'] as WaitBucket[]).map((b) => (
          <span
            key={b}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${BUCKET_BORDER[b]}`,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: BUCKET_BORDER[b],
              }}
            />
            {BUCKET_LABEL[b]}
          </span>
        ))}
      </div>

      {/* Active trailer grid */}
      <section
        aria-label="Cajas activas en patio"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 14,
          borderRadius: 20,
          background: BG_ELEVATED,
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(192,197,206,0.18)',
        }}
      >
        <h2 style={{ fontSize: 'var(--aguila-fs-body)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--portal-fg-4)', margin: 0 }}>
          Activas
        </h2>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--portal-fg-4)' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Cargando…
          </div>
        ) : entries.length === 0 ? (
          <div style={{ color: 'var(--portal-fg-5)', fontSize: 'var(--aguila-fs-body)' }}>
            Patio vacío. Registra la primera entrada abajo.
          </div>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 10,
            }}
          >
            {entries.map((e) => {
              const bucket = waitBucketFromDates(e.entered_at, now)
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setConfirmExit(e)}
                    aria-label={`Marcar salida ${e.trailer_number}`}
                    style={{
                      minHeight: 88,
                      width: '100%',
                      borderRadius: 14,
                      border: `1px solid ${BUCKET_BORDER[bucket]}`,
                      background: 'rgba(255,255,255,0.04)',
                      color: 'var(--portal-fg-1)',
                      padding: 10,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      boxShadow: BUCKET_GLOW[bucket],
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-jetbrains-mono), monospace',
                          fontSize: 'var(--aguila-fs-body-lg)',
                          fontWeight: 700,
                        }}
                      >
                        {e.yard_position}
                      </span>
                      {e.refrigerated && (
                        <Snowflake size={14} color="var(--portal-fg-3)" aria-label="Refrigerada" />
                      )}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: 'var(--aguila-fs-body)',
                        color: 'var(--portal-fg-3)',
                      }}
                    >
                      {e.trailer_number}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: 'var(--aguila-fs-meta)',
                        color: 'var(--portal-fg-4)',
                      }}
                    >
                      {formatElapsed(e.entered_at, now)}
                      {e.refrigerated && e.temperature_setting != null
                        ? ` · ${e.temperature_setting.toFixed(1)}°C`
                        : ''}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Quick entry form */}
      <section
        aria-label="Registrar entrada"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 14,
          borderRadius: 20,
          background: BG_ELEVATED,
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(192,197,206,0.18)',
        }}
      >
        <h2 style={{ fontSize: 'var(--aguila-fs-body)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--portal-fg-4)', margin: 0 }}>
          Nueva entrada
        </h2>

        {/* Embarque */}
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

        {/* Trailer */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 'var(--aguila-fs-meta)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--portal-fg-4)' }}>
            Número de caja
          </span>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            value={trailer}
            onChange={(e) => setTrailer(e.target.value)}
            placeholder="ABC-1234"
            style={{
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
        </label>

        {/* Position */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 'var(--aguila-fs-meta)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--portal-fg-4)' }}>
            Posición (A1–Z9)
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              value={position}
              onChange={(e) => setPosition(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="A1"
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
                letterSpacing: '0.08em',
              }}
              aria-label="Posición de patio"
            />
            <button
              type="button"
              onClick={() => {
                const p = parsePosition(position)
                if (p) setGridFocus(p)
                setGridOpen(true)
              }}
              aria-label="Abrir cuadrícula de patio"
              style={{
                minHeight: 60,
                minWidth: 60,
                borderRadius: 12,
                border: '1px solid rgba(192,197,206,0.18)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--portal-fg-3)',
                cursor: 'pointer',
                padding: '0 14px',
                fontWeight: 600,
              }}
            >
              Mapa
            </button>
          </div>
        </label>

        {/* Refrigerated */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(192,197,206,0.18)',
            background: BG_ELEVATED,
            minHeight: 60,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Snowflake size={18} color={refrigerated ? 'var(--portal-fg-3)' : 'var(--portal-fg-5)'} />
            <span style={{ fontSize: 15 /* WHY: refrigerated checkbox label, between body and kpi-small */, color: 'var(--portal-fg-1)' }}>Refrigerada</span>
          </span>
          <input
            type="checkbox"
            checked={refrigerated}
            onChange={(e) => setRefrigerated(e.target.checked)}
            aria-label="Caja refrigerada"
            style={{ width: 22, height: 22, cursor: 'pointer' }}
          />
        </label>

        {refrigerated && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--aguila-fs-meta)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--portal-fg-4)' }}>
              Temperatura (°C)
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={-40}
              max={40}
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              placeholder="-5.0"
              style={{
                minHeight: 60,
                padding: '0 14px',
                borderRadius: 12,
                border: '1px solid rgba(192,197,206,0.18)',
                background: BG_ELEVATED,
                color: 'var(--portal-fg-1)',
                fontSize: 'var(--aguila-fs-kpi-small)',
                fontFamily: 'var(--font-jetbrains-mono), monospace',
              }}
              aria-label="Temperatura en grados Celsius"
            />
          </label>
        )}

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

        {status === 'success' && (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              borderRadius: 12,
              background: 'var(--portal-status-green-bg)',
              border: '1px solid rgba(34,197,94,0.35)',
              color: 'var(--portal-status-green-fg)',
              fontSize: 'var(--aguila-fs-section)',
            }}
          >
            <CheckCircle2 size={18} />
            Entrada registrada
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
            fontSize: 17 /* WHY: primary submit CTA, emphasis between kpi-small and title */,
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
            'Registrar'
          )}
        </button>
      </section>

      {/* Grid picker modal */}
      {gridOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Seleccionar posición"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
            zIndex: 50,
          }}
          onClick={() => setGridOpen(false)}
        >
          <div
            ref={gridRef}
            role="grid"
            tabIndex={0}
            onKeyDown={onGridKeyDown}
            onClick={(e) => e.stopPropagation()}
            style={{
              outline: 'none',
              width: '100%',
              maxWidth: 680,
              maxHeight: '90vh',
              overflow: 'auto',
              padding: 16,
              borderRadius: 20,
              background: 'rgba(255,255,255,0.045)',
              border: '1px solid rgba(192,197,206,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--portal-fg-1)', fontSize: 15 /* WHY: grid position header, between body and kpi-small */, fontWeight: 600 }}>
                Posición · {formatPosition(gridFocus)}
              </span>
              <button
                type="button"
                onClick={() => setGridOpen(false)}
                aria-label="Cerrar"
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--portal-fg-3)',
                  cursor: 'pointer',
                }}
              >
                <X size={22} />
              </button>
            </div>
            <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)' }}>
              Flechas mueven · Enter selecciona · Esc cierra
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${GRID_COLUMNS.length}, minmax(28px, 1fr))`,
                gap: 3,
              }}
            >
              {GRID_ROWS.map((r) =>
                GRID_COLUMNS.map((c) => {
                  const label = `${c}${r}`
                  const isFocus = gridFocus.col === c && gridFocus.row === r
                  const occupied = occupiedSet.has(label)
                  const entry = entryByPosition.get(label)
                  const bucket = entry ? waitBucketFromDates(entry.entered_at, now) : null
                  return (
                    <button
                      key={label}
                      role="gridcell"
                      type="button"
                      aria-label={`Posición ${label}${occupied ? ' ocupada' : ''}`}
                      aria-selected={isFocus}
                      disabled={occupied}
                      onClick={() => {
                        if (!occupied) {
                          setPosition(label)
                          setGridOpen(false)
                        }
                      }}
                      style={{
                        aspectRatio: '1 / 1',
                        minWidth: 28,
                        borderRadius: 6,
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: 'var(--aguila-fs-label)',
                        fontWeight: 600,
                        border: isFocus
                          ? '2px solid #E8EAED'
                          : bucket
                            ? `1px solid ${BUCKET_BORDER[bucket]}`
                            : '1px solid rgba(192,197,206,0.18)',
                        background: occupied
                          ? 'rgba(192,197,206,0.15)'
                          : 'rgba(255,255,255,0.03)',
                        color: occupied ? 'var(--portal-fg-5)' : 'var(--portal-fg-1)',
                        cursor: occupied ? 'not-allowed' : 'pointer',
                        padding: 0,
                      }}
                    >
                      {label}
                    </button>
                  )
                }),
              )}
            </div>
          </div>
        </div>
      )}

      {/* Exit confirmation */}
      {confirmExit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar salida"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 60,
          }}
          onClick={() => setConfirmExit(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              padding: 20,
              borderRadius: 20,
              background: 'rgba(255,255,255,0.045)',
              border: '1px solid rgba(192,197,206,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <h3 style={{ margin: 0, color: 'var(--portal-fg-1)', fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700 }}>
              ¿Marcar salida?
            </h3>
            <p style={{ margin: 0, color: 'var(--portal-fg-3)', fontSize: 'var(--aguila-fs-section)' }}>
              Caja{' '}
              <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                {confirmExit.trailer_number}
              </span>{' '}
              en{' '}
              <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                {confirmExit.yard_position}
              </span>
              .
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirmExit(null)}
                style={{
                  flex: 1,
                  minHeight: 60,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--portal-fg-1)',
                  fontWeight: 600,
                  fontSize: 15 /* WHY: confirm-exit cancel button, between body and kpi-small */,
                  border: '1px solid rgba(192,197,206,0.18)',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void markExit(confirmExit)}
                style={{
                  flex: 1,
                  minHeight: 60,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #E8EAED 0%, #C0C5CE 50%, #7A7E86 100%)',
                  color: 'var(--portal-ink-0)',
                  fontWeight: 700,
                  fontSize: 15 /* WHY: confirm-exit primary action button, between body and kpi-small */,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <LogOut size={16} />
                Marcar salida
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
