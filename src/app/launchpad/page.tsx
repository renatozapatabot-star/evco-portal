'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useConfetti } from '@/components/celebrate'
import { EmptyState } from '@/components/ui/EmptyState'
import { fmtDate } from '@/lib/format-utils'
import { WorkflowPanel } from '@/components/launchpad/WorkflowPanel'
import VoiceFAB from '@/components/launchpad/VoiceFAB'
import { ClasificacionPanel } from '@/components/launchpad/ClasificacionPanel'
import { BorradorPanel } from '@/components/launchpad/BorradorPanel'
import { LlamarPanel } from '@/components/launchpad/LlamarPanel'
import type { LaunchpadAction, CruzAutoAction, LaunchpadData, WorkflowDetail } from '@/lib/launchpad-actions'

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchLaunchpad(): Promise<LaunchpadData | null> {
  try {
    const res = await fetch('/api/launchpad', { credentials: 'include' })
    if (!res.ok) return null
    const json = await res.json()
    return json.data ?? null
  } catch {
    return null
  }
}

async function postAction(
  sourceTable: string,
  sourceId: string,
  action: 'complete' | 'postpone',
): Promise<boolean> {
  try {
    const res = await fetch('/api/launchpad', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_table: sourceTable, source_id: sourceId, action }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function fetchWorkflowDetail(
  sourceTable: string,
  sourceId: string,
): Promise<WorkflowDetail | null> {
  try {
    const res = await fetch(
      `/api/launchpad/workflow?source_table=${encodeURIComponent(sourceTable)}&source_id=${encodeURIComponent(sourceId)}`,
      { credentials: 'include' },
    )
    if (!res.ok) return null
    const json = await res.json()
    return json.data ?? null
  } catch {
    return null
  }
}

async function postWorkflowComplete(
  sourceTable: string,
  sourceId: string,
  actionType: string,
  payload?: Record<string, string>,
): Promise<boolean> {
  try {
    const res = await fetch('/api/launchpad/workflow', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_table: sourceTable, source_id: sourceId, action_type: actionType, ...payload }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Progress Bar
// ---------------------------------------------------------------------------

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.min((completed / total) * 100, 100) : 0
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
          Progreso del día
        </span>
        <span
          className="font-mono"
          style={{ fontSize: 14, color: '#6B6B6B' }}
        >
          {completed}/{total}
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: '#E8E5E0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 4,
            background: '#C9A84C',
            transition: 'width 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Action Card
// ---------------------------------------------------------------------------

function ActionCard({
  action,
  onStart,
  onPostpone,
  loading,
  dimmed,
}: {
  action: LaunchpadAction
  onStart: () => void
  onPostpone: () => void
  loading: boolean
  dimmed?: boolean
}) {
  return (
    <div
      className="card card-enter"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        animationDelay: `${(action.rank - 1) * 80}ms`,
        opacity: dimmed ? 0.4 : 1,
        pointerEvents: dimmed ? 'none' : 'auto',
        transition: 'opacity 200ms',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Number badge */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: '#C9A84C',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 16,
            flexShrink: 0,
          }}
          className="font-mono"
        >
          {action.rank}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: '#1A1A1A',
              lineHeight: 1.3,
            }}
          >
            {action.title}
          </h3>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 14,
              color: '#6B6B6B',
              lineHeight: 1.4,
            }}
          >
            {action.reason}
          </p>
          <span
            className="font-mono"
            style={{
              display: 'inline-block',
              marginTop: 8,
              fontSize: 13,
              color: '#9B9B9B',
            }}
          >
            ~{action.estimated_minutes} min
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={onStart}
          disabled={loading}
          style={{
            flex: 1,
            minHeight: 60,
            borderRadius: 12,
            background: '#C9A84C',
            color: '#FFFFFF',
            border: 'none',
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            transition: 'background 150ms',
          }}
          onMouseOver={(e) => {
            if (!loading) (e.currentTarget.style.background = '#B8933B')
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#C9A84C'
          }}
        >
          Empezar
        </button>
        <button
          onClick={onPostpone}
          disabled={loading}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 14,
            color: '#9B9B9B',
            cursor: loading ? 'wait' : 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: 2,
            padding: '8px 4px',
          }}
        >
          Posponer
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Completion Card
// ---------------------------------------------------------------------------

function CompletionCard() {
  return (
    <div
      className="card card-enter"
      style={{
        textAlign: 'center',
        padding: 32,
        border: '2px solid #C9A84C',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 12 }}>&#10003;</div>
      <h2
        style={{
          margin: '0 0 8px',
          fontSize: 24,
          fontWeight: 700,
          color: '#1A1A1A',
        }}
      >
        Día completo
      </h2>
      <p style={{ margin: 0, fontSize: 14, color: '#6B6B6B' }}>
        Todas las acciones del día completadas.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CRUZ Auto Actions Section
// ---------------------------------------------------------------------------

function CruzAutoSection({
  autoActions,
  totalTimeSaved,
}: {
  autoActions: CruzAutoAction[]
  totalTimeSaved: number
}) {
  if (autoActions.length === 0) {
    return (
      <div style={{ marginTop: 32 }}>
        <EmptyState
          icon="&#129302;"
          title="Sin acciones automáticas hoy"
          description="CRUZ activará automatizaciones conforme aumente la confianza."
        />
      </div>
    )
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#1A1A1A',
          margin: '0 0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 20 }}>&#9889;</span>
        CRUZ ya hizo hoy:
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {autoActions.map((a) => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '8px 0',
            }}
          >
            <span style={{ color: '#16A34A', fontSize: 16, flexShrink: 0 }}>
              &#10003;
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 14, color: '#1A1A1A' }}>
                {a.description}
              </span>
              <span
                className="font-mono"
                style={{ fontSize: 12, color: '#9B9B9B', marginLeft: 8 }}
              >
                ~{a.time_saved_minutes} min ahorrados
              </span>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px solid #E8E5E0',
          fontSize: 14,
          fontWeight: 600,
          color: '#8B6914',
        }}
      >
        <span className="font-mono">
          Total ahorrado: ~{totalTimeSaved} minutos
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function LaunchpadPage() {
  const fireConfetti = useConfetti()
  const [data, setData] = useState<LaunchpadData | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem('launchpad_cache')
      return cached ? (JSON.parse(cached) as LaunchpadData) : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(!data)
  const [actionLoading, setActionLoading] = useState(false)
  const [activeWorkflow, setActiveWorkflow] = useState<{
    action: LaunchpadAction
    detail: WorkflowDetail
  } | null>(null)
  const [loadingWorkflow, setLoadingWorkflow] = useState<string | null>(null)
  const [workflowBusy, setWorkflowBusy] = useState(false)
  const celebratedRef = useRef(false)
  const chimeRef = useRef<HTMLAudioElement | null>(null)

  // Initial fetch + poll every 60s
  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      const result = await fetchLaunchpad()
      if (cancelled) return
      if (result) {
        setData(result)
        try { sessionStorage.setItem('launchpad_cache', JSON.stringify(result)) } catch { /* ignore */ }
      }
      setLoading(false)
    }
    refresh()
    const interval = setInterval(refresh, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Celebration on 3/3
  useEffect(() => {
    if (data && data.completed_count >= 3 && !celebratedRef.current) {
      celebratedRef.current = true
      fireConfetti()
      try {
        if (!chimeRef.current) {
          chimeRef.current = new Audio('/sounds/chime.wav')
          chimeRef.current.volume = 0.5
        }
        chimeRef.current.play().catch(() => { /* user hasn't interacted yet */ })
      } catch { /* ignore */ }
    }
  }, [data, fireConfetti])

  const handleStart = async (action: LaunchpadAction) => {
    setLoadingWorkflow(action.id)
    const detail = await fetchWorkflowDetail(action.source_table, action.source_id)
    setLoadingWorkflow(null)
    if (detail) {
      setActiveWorkflow({ action, detail })
    }
  }

  const handleWorkflowComplete = useCallback(async (
    actionType: string,
    payload?: Record<string, string>,
  ) => {
    if (!activeWorkflow) return
    setWorkflowBusy(true)
    const { action } = activeWorkflow
    await postWorkflowComplete(action.source_table, action.source_id, actionType, payload)
    setActiveWorkflow(null)
    setWorkflowBusy(false)
    // Re-fetch to update progress + get next actions
    const fresh = await fetchLaunchpad()
    if (fresh) setData(fresh)
  }, [activeWorkflow])

  const handlePostpone = async (action: LaunchpadAction) => {
    setActionLoading(true)
    const ok = await postAction(action.source_table, action.source_id, 'postpone')
    if (ok) {
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          actions: prev.actions.filter((a) => a.id !== action.id),
        }
      })
      const fresh = await fetchLaunchpad()
      if (fresh) setData(fresh)
    }
    setActionLoading(false)
  }

  const WORKFLOW_TITLES: Record<string, string> = {
    clasificacion: 'Revisar clasificación',
    borrador: 'Revisar borrador',
    llamar: 'Seguimiento proveedor',
  }

  const today = fmtDate(new Date())
  const completedCount = data?.completed_count ?? 0
  const actions = data?.actions ?? []
  const isComplete = completedCount >= 3

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '24px 16px',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            margin: '0 0 4px',
            fontSize: 24,
            fontWeight: 700,
            color: '#1A1A1A',
          }}
        >
          Launchpad
        </h1>
        <p
          className="font-mono"
          style={{ margin: 0, fontSize: 14, color: '#9B9B9B' }}
        >
          {today}
        </p>
      </div>

      {/* Progress */}
      <ProgressBar completed={completedCount} total={3} />

      {/* Actions or completion */}
      {loading && !data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="card"
              style={{ height: 160, opacity: 0.5 }}
            />
          ))}
        </div>
      ) : isComplete ? (
        <CompletionCard />
      ) : actions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onStart={() => handleStart(action)}
              onPostpone={() => handlePostpone(action)}
              loading={actionLoading || loadingWorkflow === action.id}
              dimmed={!!activeWorkflow}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="&#129302;"
          title="Sin acciones pendientes"
          description="CRUZ está aprendiendo. Las acciones aparecerán conforme el agente procese operaciones."
        />
      )}

      {/* Workflow panel */}
      {activeWorkflow && (
        <WorkflowPanel
          open={true}
          onClose={() => setActiveWorkflow(null)}
          title={WORKFLOW_TITLES[activeWorkflow.detail.type] ?? activeWorkflow.action.title}
        >
          {activeWorkflow.detail.type === 'clasificacion' && (
            <ClasificacionPanel
              detail={activeWorkflow.detail}
              onComplete={handleWorkflowComplete}
              loading={workflowBusy}
            />
          )}
          {activeWorkflow.detail.type === 'borrador' && (
            <BorradorPanel
              detail={activeWorkflow.detail}
              onComplete={handleWorkflowComplete}
              loading={workflowBusy}
            />
          )}
          {activeWorkflow.detail.type === 'llamar' && (
            <LlamarPanel
              detail={activeWorkflow.detail}
              onComplete={handleWorkflowComplete}
              loading={workflowBusy}
            />
          )}
        </WorkflowPanel>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: '#E8E5E0', margin: '32px 0' }} />

      {/* CRUZ Auto Actions */}
      {data && (
        <CruzAutoSection
          autoActions={data.auto_actions}
          totalTimeSaved={data.total_time_saved}
        />
      )}

      {/* Voice FAB — big mic button for hands-free operation */}
      <VoiceFAB />
    </div>
  )
}
