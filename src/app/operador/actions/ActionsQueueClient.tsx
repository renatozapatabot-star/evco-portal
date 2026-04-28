'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Zap, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { PageShell } from '@/components/aguila/PageShell'
import { GlassCard } from '@/components/aguila/GlassCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { AgentActionRow, AgentActionStatus, AgentActionKind } from '@/lib/aguila/actions'

/**
 * /operador/actions client — filters, realtime refresh, one-click Execute.
 *
 * Design choices:
 * - Tokens only: no hardcoded hex, no hardcoded fontSize. Every color,
 *   size, and radius routes through `--portal-*` / `--aguila-*` vars.
 * - Chrome via `<GlassCard>` — no inline glass rgba/backdrop outside
 *   src/components/aguila/ (core-invariant #26).
 * - Optimistic-but-honest UI: Execute button dims + shows "Ejecutando…";
 *   on success the row re-renders as `executed` via realtime refresh.
 *   On failure the server-side error_es surfaces inline.
 */

type StatusFilter = 'queue' | AgentActionStatus | 'all'

const STATUS_FILTERS: ReadonlyArray<{ key: StatusFilter; label: string }> = [
  { key: 'queue', label: 'Cola' },
  { key: 'executed', label: 'Ejecutadas' },
  { key: 'execute_failed', label: 'Con error' },
  { key: 'cancelled', label: 'Canceladas' },
  { key: 'proposed', label: 'Propuestas' },
  { key: 'committed', label: 'Autorizadas' },
  { key: 'all', label: 'Todas' },
]

const KIND_FILTERS: ReadonlyArray<{ key: AgentActionKind | 'all'; label: string }> = [
  { key: 'all', label: 'Todos los tipos' },
  { key: 'flag_shipment', label: 'Flag de embarque' },
  { key: 'draft_mensajeria_to_anabel', label: 'Mensaje a Anabel' },
  { key: 'open_oca_request', label: 'Solicitud OCA' },
]

const KIND_LABEL: Record<AgentActionKind, string> = {
  flag_shipment: 'Flag de embarque',
  draft_mensajeria_to_anabel: 'Mensaje a Anabel',
  open_oca_request: 'Solicitud OCA',
}

interface ActionsQueueClientProps {
  initial: AgentActionRow[]
  companies: Array<{ company_id: string; name: string }>
  sessionRole: string
  heroIcon: ReactNode
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const s = Math.max(0, Math.floor((now - then) / 1000))
  if (s < 60) return 'ahora'
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} d`
}

function statusCopy(status: AgentActionStatus): { label: string; tone: 'amber' | 'green' | 'red' | 'gray' | 'silver' } {
  switch (status) {
    case 'proposed':
      return { label: 'Propuesta', tone: 'silver' }
    case 'committed':
      return { label: 'Autorizada · en cola', tone: 'amber' }
    case 'executed':
      return { label: 'Ejecutada', tone: 'green' }
    case 'execute_failed':
      return { label: 'Error — reintentar', tone: 'red' }
    case 'cancelled':
      return { label: 'Cancelada', tone: 'gray' }
    default:
      return { label: status, tone: 'gray' }
  }
}

function matchesStatus(action: AgentActionRow, filter: StatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'queue') return action.status === 'committed' || action.status === 'execute_failed'
  return action.status === filter
}

export function ActionsQueueClient({
  initial,
  companies,
  sessionRole,
  heroIcon,
}: ActionsQueueClientProps) {
  const [rows, setRows] = useState<AgentActionRow[]>(initial)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('queue')
  const [kindFilter, setKindFilter] = useState<AgentActionKind | 'all'>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Record<string, 'running' | 'error'>>({})
  const [pendingError, setPendingError] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const sb = createBrowserSupabaseClient()
      const { data } = await sb
        .from('agent_actions')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(300)
      if (data) {
        setRows(data as AgentActionRow[])
      }
    } catch {
      // Soft-fail — initial SSR rows stay on screen. Next tick refreshes.
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | null = null
    try {
      const sb = createBrowserSupabaseClient()
      const channel = sb.channel('operador-actions-queue')
      channel
        .on(
          'postgres_changes' as 'system',
          { event: '*', schema: 'public', table: 'agent_actions' },
          () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
              if (!cancelled) void refresh()
            }, 800)
          },
        )
        .subscribe()
      cleanup = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        sb.removeChannel(channel)
      }
    } catch {
      // Realtime optional — manual refresh still works.
    }
    return () => {
      cancelled = true
      if (cleanup) cleanup()
    }
  }, [refresh])

  const companiesById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of companies) m.set(c.company_id, c.name)
    return m
  }, [companies])

  const filtered = useMemo(() => {
    return rows
      .filter((r) => matchesStatus(r, statusFilter))
      .filter((r) => (kindFilter === 'all' ? true : r.kind === kindFilter))
      .filter((r) => (companyFilter === 'all' ? true : r.company_id === companyFilter))
  }, [rows, statusFilter, kindFilter, companyFilter])

  const queueCount = useMemo(
    () => rows.filter((r) => r.status === 'committed' || r.status === 'execute_failed').length,
    [rows],
  )

  async function executeAction(actionId: string) {
    setPending((prev) => ({ ...prev, [actionId]: 'running' }))
    setPendingError((prev) => {
      const next = { ...prev }
      delete next[actionId]
      return next
    })
    try {
      const res = await fetch('/api/cruz-ai/actions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = json?.error?.message ?? 'No se pudo ejecutar la acción.'
        setPending((prev) => ({ ...prev, [actionId]: 'error' }))
        setPendingError((prev) => ({ ...prev, [actionId]: message }))
        return
      }
      setPending((prev) => {
        const next = { ...prev }
        delete next[actionId]
        return next
      })
      setToast(json?.data?.already ? 'Ya se había ejecutado.' : 'Acción ejecutada.')
      setTimeout(() => setToast(null), 2400)
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de red.'
      setPending((prev) => ({ ...prev, [actionId]: 'error' }))
      setPendingError((prev) => ({ ...prev, [actionId]: message }))
    }
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <PageShell
      title="Cola de Acciones"
      subtitle={`${queueCount} en cola · ${rows.length} totales · auditoría completa`}
      systemStatus={queueCount > 0 ? 'warning' : 'healthy'}
      liveTimestamp
    >
      {/* Toast */}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            borderRadius: 12,
            background: 'var(--portal-status-green-bg)',
            border: '1px solid var(--portal-status-green-ring)',
            color: 'var(--portal-status-green-fg)',
            fontSize: 'var(--aguila-fs-section)',
            fontWeight: 600,
            zIndex: 1000,
          }}
        >
          {toast}
        </div>
      ) : null}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Filters */}
        <GlassCard tier="secondary" ariaLabel="Filtros de la cola de acciones">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FilterRow label="Estado">
              {STATUS_FILTERS.map(({ key, label }) => {
                const isActive = statusFilter === key
                const count =
                  key === 'queue'
                    ? queueCount
                    : key === 'all'
                      ? rows.length
                      : rows.filter((r) => r.status === key).length
                return (
                  <FilterChip
                    key={key}
                    active={isActive}
                    onClick={() => setStatusFilter(key)}
                    label={label}
                    count={count}
                  />
                )
              })}
            </FilterRow>
            <FilterRow label="Tipo">
              {KIND_FILTERS.map(({ key, label }) => (
                <FilterChip
                  key={key}
                  active={kindFilter === key}
                  onClick={() => setKindFilter(key)}
                  label={label}
                />
              ))}
            </FilterRow>
            <FilterRow label="Cliente">
              <FilterChip
                active={companyFilter === 'all'}
                onClick={() => setCompanyFilter('all')}
                label="Todos"
              />
              {companies.slice(0, 20).map((c) => (
                <FilterChip
                  key={c.company_id}
                  active={companyFilter === c.company_id}
                  onClick={() => setCompanyFilter(c.company_id)}
                  label={c.name}
                />
              ))}
              {companies.length > 20 ? (
                <select
                  value={companies.slice(0, 20).some((c) => c.company_id === companyFilter) || companyFilter === 'all' ? '' : companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value || 'all')}
                  aria-label="Más clientes"
                  style={{
                    minHeight: 44,
                    padding: '8px 12px',
                    borderRadius: 20,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'var(--portal-fg-3)',
                    fontSize: 'var(--aguila-fs-body)',
                    fontWeight: 600,
                  }}
                >
                  <option value="">Más clientes…</option>
                  {companies.slice(20).map((c) => (
                    <option key={c.company_id} value={c.company_id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </FilterRow>
          </div>
        </GlassCard>

        {/* List */}
        {filtered.length === 0 ? (
          <GlassCard tier="secondary">
            <EmptyState
              icon="✅"
              title="Sin acciones en esta vista"
              description={
                statusFilter === 'queue'
                  ? 'La cola está vacía. Las próximas acciones autorizadas aparecerán aquí.'
                  : 'Ajusta los filtros para ver más historial.'
              }
            />
          </GlassCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((action) => {
              const isExpanded = expanded.has(action.id)
              const executable = action.status === 'committed' || action.status === 'execute_failed'
              const pendingState = pending[action.id]
              const errorMsg = pendingError[action.id]
              const companyName = companiesById.get(action.company_id) ?? action.company_id
              const statusInfo = statusCopy(action.status)
              return (
                <GlassCard key={action.id} tier="secondary" ariaLabel={`Acción ${KIND_LABEL[action.kind]}`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Row header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0, flex: 1 }}>
                        <button
                          type="button"
                          onClick={() => toggleExpanded(action.id)}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                          style={{
                            minWidth: 44,
                            minHeight: 44,
                            padding: 10,
                            borderRadius: 10,
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            color: 'var(--portal-fg-3)',
                            cursor: 'pointer',
                          }}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 'var(--aguila-fs-meta)',
                              color: 'var(--portal-fg-4)',
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              fontFamily: 'var(--font-jetbrains-mono), monospace',
                              marginBottom: 4,
                            }}
                          >
                            {KIND_LABEL[action.kind]} · {companyName}
                          </div>
                          <div
                            style={{
                              fontSize: 'var(--aguila-fs-section)',
                              color: 'var(--portal-fg-1)',
                              fontWeight: 600,
                              lineHeight: 1.35,
                            }}
                          >
                            {action.summary_es}
                          </div>
                        </div>
                      </div>
                      <StatusPill label={statusInfo.label} tone={statusInfo.tone} />
                    </div>

                    {/* Meta row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        flexWrap: 'wrap',
                        fontSize: 'var(--aguila-fs-meta)',
                        color: 'var(--portal-fg-4)',
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                      }}
                    >
                      <MetaIcon icon={<Clock size={11} />} label={`propuesta ${formatRelative(action.created_at)}`} />
                      {action.committed_at ? (
                        <MetaIcon icon={<CheckCircle2 size={11} />} label={`autorizada ${formatRelative(action.committed_at)}`} />
                      ) : null}
                      {action.executed_at ? (
                        <MetaIcon icon={<Zap size={11} />} label={`ejecutada ${formatRelative(action.executed_at)}`} />
                      ) : null}
                      {action.cancelled_at ? (
                        <MetaIcon icon={<XCircle size={11} />} label={`cancelada ${formatRelative(action.cancelled_at)}`} />
                      ) : null}
                      {action.execute_attempts && action.execute_attempts > 0 ? (
                        <MetaIcon icon={<AlertTriangle size={11} />} label={`${action.execute_attempts} intento(s)`} />
                      ) : null}
                      <span>
                        actor:{' '}
                        <span style={{ color: 'var(--portal-fg-3)' }}>
                          {action.actor_role}
                          {action.actor_id ? ` · ${action.actor_id.slice(0, 8)}` : ''}
                        </span>
                      </span>
                    </div>

                    {/* Execute error */}
                    {(action.execute_error_es || errorMsg) ? (
                      <div
                        role="alert"
                        style={{
                          padding: 10,
                          borderRadius: 10,
                          background: 'var(--portal-status-red-bg)',
                          border: '1px solid var(--portal-status-red-ring)',
                          color: 'var(--portal-status-red-fg)',
                          fontSize: 'var(--aguila-fs-body)',
                        }}
                      >
                        {errorMsg ?? action.execute_error_es}
                      </div>
                    ) : null}

                    {/* Expanded audit detail */}
                    {isExpanded ? (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr)',
                          gap: 10,
                          padding: 12,
                          borderRadius: 10,
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <AuditRow label="Acción" value={action.id} mono />
                        <AuditRow label="Cliente" value={`${companyName} · ${action.company_id}`} mono />
                        <AuditRow label="Estado" value={action.status} mono />
                        <AuditRow label="Decisión asociada" value={action.decision_id ?? '—'} mono />
                        <AuditRow label="Límite de cancelación" value={action.commit_deadline_at} mono />
                        {action.cancel_reason_es ? (
                          <AuditRow label="Motivo de cancelación" value={action.cancel_reason_es} />
                        ) : null}
                        {action.executed_by ? (
                          <AuditRow
                            label="Ejecutada por"
                            value={`${action.executed_by_role ?? '—'} · ${action.executed_by.slice(0, 12)}`}
                            mono
                          />
                        ) : null}
                        <AuditRow
                          label="Payload"
                          value={<Pre>{JSON.stringify(action.payload, null, 2)}</Pre>}
                        />
                        {action.execute_result ? (
                          <AuditRow
                            label="Resultado"
                            value={<Pre>{JSON.stringify(action.execute_result, null, 2)}</Pre>}
                          />
                        ) : null}
                      </div>
                    ) : null}

                    {/* Action footer */}
                    {executable ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => executeAction(action.id)}
                          disabled={pendingState === 'running'}
                          aria-busy={pendingState === 'running'}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            minHeight: 44,
                            padding: '10px 18px',
                            borderRadius: 10,
                            background:
                              pendingState === 'running'
                                ? 'rgba(192,197,206,0.08)'
                                : 'rgba(192,197,206,0.16)',
                            border: '1px solid rgba(192,197,206,0.28)',
                            color: 'var(--portal-fg-1)',
                            fontSize: 'var(--aguila-fs-body)',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            cursor: pendingState === 'running' ? 'wait' : 'pointer',
                          }}
                        >
                          <Zap size={14} aria-hidden />
                          {pendingState === 'running'
                            ? 'Ejecutando…'
                            : action.status === 'execute_failed'
                              ? 'Reintentar'
                              : 'Ejecutar'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </GlassCard>
              )
            })}
          </div>
        )}

        {/* Dev-only role signal — keeps the surface honest about who can act */}
        <div
          style={{
            fontSize: 'var(--aguila-fs-meta)',
            color: 'var(--portal-fg-5)',
            textAlign: 'center',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            marginTop: 8,
          }}
        >
          sesión: {sessionRole}
        </div>
      </section>
      {heroIcon ? <span style={{ display: 'none' }}>{heroIcon}</span> : null}
    </PageShell>
  )
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span
        style={{
          fontSize: 'var(--aguila-fs-label)',
          color: 'var(--portal-fg-5)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          minWidth: 64,
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '10px 14px',
        minHeight: 44,
        borderRadius: 20,
        background: active ? 'rgba(192,197,206,0.1)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'rgba(192,197,206,0.3)' : 'rgba(255,255,255,0.08)'}`,
        color: active ? 'var(--portal-fg-2)' : 'var(--portal-fg-4)',
        fontSize: 'var(--aguila-fs-body)',
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {typeof count === 'number' && count > 0 ? (
        <span
          style={{
            fontSize: 'var(--aguila-fs-meta)',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            background: active ? 'rgba(192,197,206,0.2)' : 'rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: '1px 6px',
            minWidth: 20,
            textAlign: 'center',
          }}
        >
          {count}
        </span>
      ) : null}
    </button>
  )
}

function StatusPill({
  label,
  tone,
}: {
  label: string
  tone: 'amber' | 'green' | 'red' | 'gray' | 'silver'
}) {
  const palette =
    tone === 'silver'
      ? { bg: 'rgba(192,197,206,0.1)', fg: 'var(--portal-fg-3)', ring: 'rgba(192,197,206,0.28)' }
      : tone === 'gray'
        ? { bg: 'rgba(255,255,255,0.04)', fg: 'var(--portal-fg-4)', ring: 'rgba(255,255,255,0.08)' }
        : {
            bg: `var(--portal-status-${tone}-bg)`,
            fg: `var(--portal-status-${tone}-fg)`,
            ring: `var(--portal-status-${tone}-ring)`,
          }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderRadius: 999,
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.ring}`,
        fontSize: 'var(--aguila-fs-meta)',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor' }}
      />
      {label}
    </span>
  )
}

function MetaIcon({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </span>
  )
}

function AuditRow({
  label,
  value,
  mono,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, alignItems: 'start' }}>
      <span
        style={{
          fontSize: 'var(--aguila-fs-label)',
          color: 'var(--portal-fg-5)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 'var(--aguila-fs-body)',
          color: 'var(--portal-fg-2)',
          fontFamily: mono ? 'var(--font-jetbrains-mono), monospace' : 'var(--font-sans)',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function Pre({ children }: { children: ReactNode }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: 10,
        borderRadius: 8,
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.06)',
        color: 'var(--portal-fg-2)',
        fontSize: 'var(--aguila-fs-meta)',
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: 240,
        overflow: 'auto',
      }}
    >
      {children}
    </pre>
  )
}
