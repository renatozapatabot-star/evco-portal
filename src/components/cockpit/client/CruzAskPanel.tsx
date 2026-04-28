'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  traficoHref,
  fraccionHref,
  pedimentoHref,
  supplierHref,
} from '@/lib/aguila/ref-links'

interface DataRefs {
  traficos: string[]
  pedimentos: string[]
  fracciones: string[]
  amounts: Array<{ value: number; currency: string; raw: string }>
  suppliers: string[]
}

interface PendingAction {
  action_id: string
  kind: string
  summary_es: string
  commit_deadline_at: string
  /** 'pending' = inside 5s window · 'committed' / 'cancelled' = terminal */
  status: 'pending' | 'committed' | 'cancelled' | 'error'
  /** Spanish message shown after terminal transition. */
  resolution_es?: string
}

export function AduanaAskPanel() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [isFallback, setIsFallback] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusLabel, setStatusLabel] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [dataRefs, setDataRefs] = useState<DataRefs | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number>(0)

  // Persist the conversation + session ids between turns so the route
  // can load prior history. Survives re-renders; resets on page reload.
  const conversationIdRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const FALLBACK = (
    'El asistente PORTAL estará disponible muy pronto. Mientras tanto, tu operación sigue al corriente. ' +
    'Para preguntas urgentes, contacta a tu agente aduanal.'
  )

  const examples = [
    '¿Cuál es el estatus de mi último embarque?',
    '¿Cuántos pedimentos tengo este mes?',
    '¿Qué documentos me faltan?',
    '¿Cuánto pagué en aranceles este mes?',
  ]

  async function handleSubmit(e?: React.FormEvent, overrideText?: string) {
    e?.preventDefault()
    const text = (overrideText ?? question).trim()
    if (!text || loading) return

    setLoading(true)
    setAnswer(null)
    setIsFallback(false)
    setStatusLabel('Analizando tu pregunta...')
    setSuggestions([])
    setDataRefs(null)
    setPendingAction(null)

    try {
      const res = await fetch('/api/cruz-ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          stream: true,
          sessionId: sessionIdRef.current,
          conversationId: conversationIdRef.current,
        }),
      })

      if (!res.body) throw new Error('no_body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let streamedAnswer = ''
      let doneSignaled = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const raw = buffer.slice(0, idx).trim()
          buffer = buffer.slice(idx + 1)
          if (!raw) continue
          let evt: Record<string, unknown>
          try { evt = JSON.parse(raw) as Record<string, unknown> } catch { continue }
          const type = String(evt.type ?? '')
          if (type === 'meta') {
            if (typeof evt.conversationId === 'string') conversationIdRef.current = evt.conversationId
            if (typeof evt.sessionId === 'string') sessionIdRef.current = evt.sessionId
            setStatusLabel('Consultando tu operación...')
          } else if (type === 'tool') {
            setStatusLabel(labelForTool(String(evt.name ?? '')))
          } else if (type === 'delta') {
            streamedAnswer += String(evt.text ?? '')
            setAnswer(streamedAnswer)
            setStatusLabel(null)
          } else if (type === 'suggestions') {
            setSuggestions(Array.isArray(evt.items) ? (evt.items as string[]) : [])
          } else if (type === 'data') {
            setDataRefs(evt.refs as DataRefs)
          } else if (type === 'action') {
            // Phase 5 Option 1 — write-gated tool proposed an action
            // with a 5-second cancel window. UI owns the countdown +
            // auto-commit; server owns the deadline as source of truth.
            setPendingAction({
              action_id: String(evt.action_id ?? ''),
              kind: String(evt.kind ?? ''),
              summary_es: String(evt.summary_es ?? ''),
              commit_deadline_at: String(evt.commit_deadline_at ?? ''),
              status: 'pending',
            })
          } else if (type === 'done') {
            doneSignaled = true
            setIsFallback(Boolean(evt.fallback))
            if (typeof evt.answer === 'string' && evt.answer) setAnswer(evt.answer)
            if (typeof evt.conversationId === 'string') conversationIdRef.current = evt.conversationId
            if (typeof evt.sessionId === 'string') sessionIdRef.current = evt.sessionId
          }
        }
      }

      if (!doneSignaled) {
        setAnswer(FALLBACK)
        setIsFallback(true)
      }
    } catch {
      setAnswer(FALLBACK)
      setIsFallback(true)
    } finally {
      setStatusLabel(null)
      setLoading(false)
      setQuestion('')
    }
  }

  // Countdown + auto-commit effect. Runs while a `pending` action is
  // in flight. Recomputes seconds-left each tick against the server's
  // `commit_deadline_at` so clock drift doesn't extend the window.
  useEffect(() => {
    if (!pendingAction || pendingAction.status !== 'pending') {
      setSecondsLeft(0)
      return
    }
    const deadlineMs = Date.parse(pendingAction.commit_deadline_at)
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      const left = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left <= 0) {
        void commitNow(pendingAction.action_id)
      }
    }
    tick()
    const iv = window.setInterval(tick, 250)
    return () => { cancelled = true; window.clearInterval(iv) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAction?.action_id, pendingAction?.status])

  async function commitNow(actionId: string) {
    try {
      const res = await fetch('/api/cruz-ai/actions/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId }),
      })
      const body = (await res.json().catch(() => null)) as
        | { data?: { status?: string; message_es?: string }; error?: { message?: string } | null }
        | null
      if (res.ok && body?.data?.status === 'committed') {
        setPendingAction((prev) =>
          prev && prev.action_id === actionId
            ? { ...prev, status: 'committed', resolution_es: body.data?.message_es ?? 'Acción confirmada.' }
            : prev,
        )
      } else {
        setPendingAction((prev) =>
          prev && prev.action_id === actionId
            ? { ...prev, status: 'error', resolution_es: body?.error?.message ?? 'No se pudo confirmar la acción.' }
            : prev,
        )
      }
    } catch {
      setPendingAction((prev) =>
        prev && prev.action_id === actionId
          ? { ...prev, status: 'error', resolution_es: 'No se pudo contactar al servidor para confirmar.' }
          : prev,
      )
    }
  }

  async function cancelNow(actionId: string) {
    // Optimistic — snap to cancelled locally so the countdown stops;
    // if the server disagrees (race with auto-commit) we swap back.
    setPendingAction((prev) =>
      prev && prev.action_id === actionId ? { ...prev, status: 'cancelled' } : prev,
    )
    try {
      const res = await fetch('/api/cruz-ai/actions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, reasonEs: 'user_clicked_cancel' }),
      })
      const body = (await res.json().catch(() => null)) as
        | { data?: { status?: string; message_es?: string }; error?: { message?: string } | null }
        | null
      setPendingAction((prev) => {
        if (!prev || prev.action_id !== actionId) return prev
        if (res.ok && body?.data?.status === 'cancelled') {
          return { ...prev, status: 'cancelled', resolution_es: body.data?.message_es ?? 'Acción cancelada.' }
        }
        if (body?.data?.status === 'committed') {
          return { ...prev, status: 'committed', resolution_es: 'La acción ya se había confirmado.' }
        }
        return { ...prev, status: 'error', resolution_es: body?.error?.message ?? 'No se pudo cancelar.' }
      })
    } catch {
      setPendingAction((prev) =>
        prev && prev.action_id === actionId
          ? { ...prev, status: 'error', resolution_es: 'No se pudo contactar al servidor para cancelar.' }
          : prev,
      )
    }
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.045)', borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: '3px solid rgba(192,197,206,0.4)',
      padding: 16,
    }}>
      <div style={{
        fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--portal-fg-5)', marginBottom: 12,
      }}>
        Pregúntale a PORTAL
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {examples.map(ex => (
          <button
            key={ex}
            onClick={() => setQuestion(ex)}
            style={{
              background: 'rgba(255,255,255,0.045)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 'var(--aguila-fs-compact)',
              color: 'var(--portal-fg-4)',
              cursor: 'pointer',
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Escribe tu pregunta..."
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.045)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '14px 16px',
            fontSize: 'var(--aguila-fs-section)',
            color: 'var(--portal-fg-1)',
            outline: 'none',
            minHeight: 48,
          }}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          style={{
            background: 'var(--portal-fg-1)',
            color: 'var(--portal-ink-0)',
            border: 'none',
            borderRadius: 10,
            padding: '0 20px',
            fontSize: 'var(--aguila-fs-section)',
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading || !question.trim() ? 0.5 : 1,
            minHeight: 48,
            minWidth: 60,
          }}
        >
          {loading ? '...' : '→'}
        </button>
      </form>

      {statusLabel && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: 12,
            fontSize: 'var(--aguila-fs-compact)',
            color: 'var(--portal-fg-4)',
            fontStyle: 'italic',
          }}
        >
          {statusLabel}
        </div>
      )}

      {pendingAction && (
        <div
          role="alertdialog"
          aria-live="assertive"
          aria-label="Ventana de cancelación de 5 segundos"
          style={{
            marginTop: 12,
            padding: '12px 14px',
            borderRadius: 12,
            background:
              pendingAction.status === 'cancelled'
                ? 'rgba(192,197,206,0.08)'
                : pendingAction.status === 'committed'
                  ? 'rgba(34,197,94,0.08)'
                  : pendingAction.status === 'error'
                    ? 'rgba(239,68,68,0.08)'
                    : 'rgba(251,191,36,0.08)',
            border:
              pendingAction.status === 'cancelled'
                ? '1px solid rgba(192,197,206,0.25)'
                : pendingAction.status === 'committed'
                  ? '1px solid rgba(34,197,94,0.3)'
                  : pendingAction.status === 'error'
                    ? '1px solid rgba(239,68,68,0.3)'
                    : '1px solid rgba(251,191,36,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-2)', fontWeight: 600 }}>
              {pendingAction.status === 'pending'
                ? 'Acción propuesta'
                : pendingAction.status === 'committed'
                  ? 'Confirmada'
                  : pendingAction.status === 'cancelled'
                    ? 'Cancelada'
                    : 'Error'}
            </div>
            <div
              style={{
                fontSize: 'var(--aguila-fs-compact)',
                color: 'var(--portal-fg-3)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {pendingAction.summary_es}
            </div>
            {pendingAction.resolution_es && (
              <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-4)' }}>
                {pendingAction.resolution_es}
              </div>
            )}
          </div>
          {pendingAction.status === 'pending' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span
                aria-label={`Se confirma en ${secondsLeft} segundos`}
                style={{
                  minWidth: 60,
                  textAlign: 'center',
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.25)',
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: 'var(--aguila-fs-compact)',
                  color: 'var(--portal-fg-2)',
                }}
              >
                {secondsLeft}s
              </span>
              <button
                onClick={() => cancelNow(pendingAction.action_id)}
                style={{
                  minHeight: 36,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(239,68,68,0.35)',
                  background: 'rgba(239,68,68,0.12)',
                  color: 'var(--portal-fg-1)',
                  fontSize: 'var(--aguila-fs-compact)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {answer && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: 12,
            padding: '12px 16px',
            background: isFallback ? 'rgba(251,191,36,0.06)' : 'rgba(192,197,206,0.06)',
            borderRadius: 10,
            border: `1px solid ${isFallback ? 'var(--portal-status-amber-ring)' : 'rgba(192,197,206,0.15)'}`,
            fontSize: 'var(--aguila-fs-section)',
            color: 'var(--portal-fg-1)',
            lineHeight: 1.5,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          {isFallback && (
            <span aria-hidden style={{ fontSize: 16, lineHeight: '20px', opacity: 0.9 }}>⏳</span>
          )}
          <span style={{ flex: 1 }}>{answer}</span>
        </div>
      )}

      {dataRefs && hasAnyRef(dataRefs) && (
        <div
          style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}
          aria-label="Referencias detectadas"
        >
          {dataRefs.traficos.map(t => (
            <Link key={`t-${t}`} href={traficoHref(t)} style={chipStyle} prefetch={false}>
              Tráfico {t}
            </Link>
          ))}
          {dataRefs.pedimentos.map(p => (
            <Link key={`p-${p}`} href={pedimentoHref(p)} style={chipStyle} prefetch={false}>
              Pedimento {p}
            </Link>
          ))}
          {dataRefs.fracciones.map(f => (
            <Link key={`f-${f}`} href={fraccionHref(f)} style={chipStyle} prefetch={false}>
              Fracción {f}
            </Link>
          ))}
          {dataRefs.suppliers.map(s => (
            <Link key={`s-${s}`} href={supplierHref(s)} style={chipStyle} prefetch={false}>
              Proveedor {s}
            </Link>
          ))}
        </div>
      )}

      {suggestions.length > 0 && !loading && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => handleSubmit(undefined, s)}
              style={{
                background: 'rgba(192,197,206,0.1)',
                border: '1px solid rgba(192,197,206,0.25)',
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: 'var(--aguila-fs-compact)',
                color: 'var(--portal-fg-2)',
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const chipStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.045)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '4px 10px',
  fontSize: 'var(--aguila-fs-compact)',
  color: 'var(--portal-fg-3)',
  fontFamily: 'var(--font-jetbrains-mono), monospace',
  textDecoration: 'none',
  cursor: 'pointer',
}

function hasAnyRef(r: DataRefs): boolean {
  return (
    r.traficos.length > 0 ||
    r.pedimentos.length > 0 ||
    r.fracciones.length > 0 ||
    r.suppliers.length > 0
  )
}

function labelForTool(name: string): string {
  switch (name) {
    case 'query_traficos': return 'Revisando embarques...'
    case 'query_pedimentos': return 'Revisando pedimentos...'
    case 'query_catalogo': return 'Revisando catálogo...'
    case 'query_financiero': return 'Revisando estado financiero...'
    case 'query_expedientes': return 'Revisando expedientes...'
    case 'analyze_trafico': return 'Analizando embarque...'
    case 'analyze_pedimento': return 'Analizando pedimento...'
    case 'validate_pedimento': return 'Validando cifras del pedimento...'
    case 'suggest_clasificacion': return 'Buscando fracción en tu historial...'
    case 'check_tmec_eligibility': return 'Verificando elegibilidad T-MEC...'
    case 'search_supplier_history': return 'Revisando historial del proveedor...'
    case 'find_missing_documents': return 'Revisando documentos del expediente...'
    case 'tenant_anomalies': return 'Revisando anomalías...'
    case 'intelligence_scan': return 'Analizando la operación...'
    case 'draft_mensajeria': return 'Redactando borrador...'
    case 'learning_report': return 'Generando reporte de aprendizaje...'
    case 'route_mention': return 'Resolviendo mención...'
    default: return 'Consultando...'
  }
}
