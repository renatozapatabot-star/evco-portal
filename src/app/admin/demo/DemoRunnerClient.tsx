'use client'

/**
 * AGUILA · V1.5 F9 — Demo orchestrator UI.
 *
 * Silver glass. Single button. Live progress panel polls /status every 3s.
 * Reset purges synthetic data. No blue/cyan/gold. Mono on amounts + codes.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  ACCENT_SILVER_DIM,
  BORDER,
  BORDER_HAIRLINE,
  GLASS_SHADOW,
  SILVER_GRADIENT,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'

interface DemoStep {
  id: number
  key: string
  label: string
  status: 'pending' | 'running' | 'done' | 'failed'
  at?: string
  detail?: string
}

interface DemoRun {
  runId: string
  companyId: string
  traficoId: string
  startedAt: string
  currentStep: number
  steps: DemoStep[]
  error?: string
  finishedAt?: string
}

type StatusResponse =
  | { data: DemoRun; error: null }
  | { data: { status: 'unknown'; runId: string }; error: null }
  | { data: null; error: { code: string; message: string } }

export function DemoRunnerClient() {
  const [run, setRun] = useState<DemoRun | null>(null)
  const [starting, setStarting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const pollStatus = useCallback(async (runId: string) => {
    try {
      const res = await fetch(`/api/demo/status/${runId}`, { cache: 'no-store' })
      const body: StatusResponse = await res.json()
      if (body.error) return
      if (body.data && 'steps' in body.data) {
        setRun(body.data)
        if (body.data.finishedAt) stopPolling()
      }
    } catch {
      // transient — keep polling
    }
  }, [stopPolling])

  async function handleStart() {
    setStarting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/demo/start', { method: 'POST' })
      const body = await res.json()
      if (body.error) {
        setMessage(body.error.message)
      } else {
        const runId = body.data.runId as string
        setMessage(`Tráfico sintético ${body.data.traficoId} creado.`)
        // seed an empty run view immediately
        setRun({
          runId,
          companyId: 'aguila-demo',
          traficoId: body.data.traficoId,
          startedAt: new Date().toISOString(),
          currentStep: 0,
          steps: [],
        })
        stopPolling()
        pollRef.current = setInterval(() => pollStatus(runId), 3000)
        // kick an immediate poll so the checklist appears fast
        void pollStatus(runId)
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setStarting(false)
    }
  }

  async function handleReset() {
    setResetting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' })
      const body = await res.json()
      if (body.error) {
        setMessage(body.error.message)
      } else {
        stopPolling()
        setRun(null)
        setMessage(`Demo reiniciado. ${body.data?.deleted ?? 0} tráfico(s) purgado(s).`)
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setResetting(false)
    }
  }

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  const running = !!run && !run.finishedAt
  const done = !!run?.finishedAt
  const doneCount = run?.steps.filter((s) => s.status === 'done').length ?? 0
  const totalCount = run?.steps.length ?? 12

  return (
    <div
      style={{
        padding: '24px 16px',
        maxWidth: 960,
        margin: '0 auto',
        color: TEXT_PRIMARY,
      }}
    >
      <header style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontFamily: 'var(--font-geist-sans)',
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            margin: 0,
            background: SILVER_GRADIENT,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Demo orquestado AGUILA
        </h1>
        <p style={{ fontSize: 14, color: TEXT_SECONDARY, marginTop: 6, marginBottom: 0 }}>
          90 segundos. Un tráfico sintético{' '}
          <code
            style={{
              fontFamily: 'var(--font-jetbrains-mono)',
              color: ACCENT_SILVER_BRIGHT,
            }}
          >
            DEMO EVCO PLASTICS
          </code>{' '}
          recorre las 12 etapas del ciclo. Corredor y cronología se llenan solos.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {/* Left — controls */}
        <section
          style={{
            background: 'rgba(9,9,11,0.75)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            padding: 20,
            boxShadow: GLASS_SHADOW,
          }}
        >
          <h2
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: TEXT_MUTED,
              margin: 0,
              marginBottom: 12,
            }}
          >
            Control
          </h2>

          <p style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 0 }}>
            Al iniciar, AGUILA emite 12 eventos secuenciales que poblan tráficos,
            clasificación, corredor, PECE, MVE, factura y exportación QuickBooks.
            Todo con el cliente sintético <code style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>aguila-demo</code>.
          </p>

          <button
            type="button"
            onClick={handleStart}
            disabled={starting || running}
            style={{
              width: '100%',
              minHeight: 60,
              borderRadius: 16,
              border: `1px solid ${ACCENT_SILVER}`,
              background: SILVER_GRADIENT,
              color: '#0A0A0C',
              fontFamily: 'var(--font-geist-sans)',
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              cursor: starting || running ? 'not-allowed' : 'pointer',
              opacity: starting || running ? 0.6 : 1,
              marginBottom: 12,
            }}
          >
            {starting ? 'Iniciando…' : running ? 'Demo en curso…' : 'Iniciar demo'}
          </button>

          {(run || done) && (
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              style={{
                width: '100%',
                minHeight: 60,
                borderRadius: 16,
                border: `1px solid ${BORDER_HAIRLINE}`,
                background: 'transparent',
                color: ACCENT_SILVER_BRIGHT,
                fontFamily: 'var(--font-geist-sans)',
                fontSize: 14,
                fontWeight: 600,
                cursor: resetting ? 'not-allowed' : 'pointer',
                opacity: resetting ? 0.6 : 1,
              }}
            >
              {resetting ? 'Reiniciando…' : 'Reiniciar demo'}
            </button>
          )}

          {message && (
            <p
              style={{
                marginTop: 16,
                fontSize: 13,
                color: ACCENT_SILVER_BRIGHT,
                fontFamily: 'var(--font-geist-sans)',
              }}
            >
              {message}
            </p>
          )}

          {run?.traficoId && (
            <div style={{ marginTop: 16, fontSize: 12, color: TEXT_MUTED }}>
              Tráfico:{' '}
              <code
                style={{
                  fontFamily: 'var(--font-jetbrains-mono)',
                  color: ACCENT_SILVER_BRIGHT,
                  fontSize: 13,
                }}
              >
                {run.traficoId}
              </code>
              <br />
              Inicio:{' '}
              <code
                style={{
                  fontFamily: 'var(--font-jetbrains-mono)',
                  color: TEXT_SECONDARY,
                  fontSize: 12,
                }}
              >
                {fmtDateTime(run.startedAt)}
              </code>
            </div>
          )}
        </section>

        {/* Right — progress */}
        <section
          style={{
            background: 'rgba(9,9,11,0.75)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            padding: 20,
            boxShadow: GLASS_SHADOW,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <h2
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: TEXT_MUTED,
                margin: 0,
              }}
            >
              Progreso
            </h2>
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono)',
                color: ACCENT_SILVER_BRIGHT,
                fontSize: 13,
              }}
            >
              {doneCount}/{totalCount}
            </span>
          </div>

          {!run || run.steps.length === 0 ? (
            <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: 0 }}>
              Sin demo activo. Presiona <strong>Iniciar demo</strong> para arrancar.
            </p>
          ) : (
            <ol
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {run.steps.map((step) => (
                <li
                  key={step.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: `1px solid ${BORDER_HAIRLINE}`,
                    background:
                      step.status === 'running' ? 'rgba(192,197,206,0.08)' : 'transparent',
                    minHeight: 44,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      marginTop: 6,
                      background:
                        step.status === 'done'
                          ? ACCENT_SILVER_BRIGHT
                          : step.status === 'running'
                          ? ACCENT_SILVER
                          : step.status === 'failed'
                          ? '#EF4444'
                          : ACCENT_SILVER_DIM,
                      boxShadow:
                        step.status === 'running'
                          ? '0 0 12px rgba(192,197,206,0.6)'
                          : 'none',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: TEXT_PRIMARY,
                        fontFamily: 'var(--font-geist-sans)',
                      }}
                    >
                      {step.label}
                    </div>
                    {step.detail && (
                      <div
                        style={{
                          fontSize: 12,
                          color: TEXT_SECONDARY,
                          marginTop: 2,
                        }}
                      >
                        {step.detail}
                      </div>
                    )}
                    {step.at && (
                      <div
                        style={{
                          fontSize: 11,
                          color: TEXT_MUTED,
                          fontFamily: 'var(--font-jetbrains-mono)',
                          marginTop: 2,
                        }}
                      >
                        {fmtDateTime(step.at)}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}

          {done && (
            <p
              style={{
                marginTop: 16,
                fontSize: 13,
                fontWeight: 600,
                color: ACCENT_SILVER_BRIGHT,
              }}
            >
              Demo completado. Revisa /corredor y /traficos/{run?.traficoId}/trace.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
