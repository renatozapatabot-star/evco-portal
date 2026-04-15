'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import { fmtDate, fmtDateTime } from '@/lib/format-utils'
import { GOLD, GOLD_GRADIENT, GREEN, AMBER, RED, BG_CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_CYAN } from '@/lib/design-system'
import { WORKFLOW_LABELS, WORKFLOW_ORDER } from '@/lib/workflow-events'
import { ChaserButton } from '../ChaserButton'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { AdminHeroStrip } from './AdminHeroStrip'
import { ActionEngine } from './ActionEngine'
import { AdminRightRail } from './AdminRightRail'
import type {
  PendingDraft, PipelineStage, ActivityEvent, TeamMember,
  CompanyHealth, WorkflowStats, SyncCoverage, StuckTrafico, LeaderboardEntry,
} from '@/types/cockpit'

interface AdminCockpitProps {
  // Hero strip
  criticos: number
  urgentes: number
  normales: number
  decisionesHoy: number
  // Action Engine
  topDraft: PendingDraft | null
  totalPending: number
  // Right rail
  pipeline: PipelineStage[]
  activity: ActivityEvent[]
  team: TeamMember[]
  // Below fold
  companies: CompanyHealth[]
  workflowStats: WorkflowStats[]
  totalWfEvents: number
  stuckCount: number
  oldestStuckMin: number
  failedOrDead: number
  syncCoverage: SyncCoverage[]
  leaderboard: LeaderboardEntry[]
  stuckTraficos: StuckTrafico[]
  recentActions: ActivityEvent[]
  opNames: Record<string, string>
  opEmails: Record<string, string>
  recentClassifications: Array<Record<string, string | null>>
}

function healthBadge(score: number) {
  if (score >= 80) return { bg: 'rgba(22,163,74,0.15)', color: GREEN, border: 'rgba(22,163,74,0.3)' }
  if (score >= 60) return { bg: 'rgba(217,119,6,0.15)', color: AMBER, border: 'rgba(217,119,6,0.3)' }
  return { bg: 'rgba(220,38,38,0.15)', color: RED, border: 'rgba(220,38,38,0.3)' }
}

function ageMsSince(iso: string): number {
  return Date.now() - new Date(iso).getTime()
}

function sourceBadge(source: string | null) {
  if (!source) return { bg: 'rgba(102,102,102,0.15)', color: TEXT_MUTED, label: '\u2014' }
  if (source === 'ai_auto_classifier') return { bg: 'rgba(192,197,206,0.15)', color: GOLD, label: 'AI' }
  if (source.startsWith('human')) return { bg: 'rgba(22,163,74,0.15)', color: GREEN, label: 'Humano' }
  return { bg: 'rgba(102,102,102,0.15)', color: TEXT_MUTED, label: source }
}

export function AdminCockpit(props: AdminCockpitProps) {
  const [heroData, setHeroData] = useState({
    criticos: props.criticos,
    urgentes: props.urgentes,
    normales: props.normales,
    decisionesHoy: props.decisionesHoy,
  })
  const [topDraft, setTopDraft] = useState(props.topDraft)
  const [totalPending, setTotalPending] = useState(props.totalPending)
  const [activity, setActivity] = useState(props.activity)
  const [isLive, setIsLive] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshData = useCallback(async () => {
    const sb = createBrowserSupabaseClient()
    const now = new Date()
    const sixHoursAgo = new Date(now.getTime() - 6 * 3600000).toISOString()
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600000).toISOString()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    const [pendingRes, draftsRes, topDraftRes, activityRes] = await Promise.all([
      sb.from('workflow_events')
        .select('id, created_at, status')
        .in('status', ['pending', 'failed', 'dead_letter']),
      sb.from('pedimento_drafts')
        .select('id', { count: 'exact', head: true })
        .in('status', ['ready_for_approval', 'draft', 'pending']),
      sb.from('pedimento_drafts')
        .select('id, trafico_id, company_id, draft_data, created_at, status')
        .in('status', ['ready_for_approval', 'draft', 'pending'])
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      sb.from('operator_actions')
        .select('id, operator_id, action_type, target_id, payload, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    // Bucket exceptions by age
    const events = (pendingRes.data || []) as Array<{ id: string; created_at: string; status: string }>
    let crit = 0, urg = 0, norm = 0
    for (const e of events) {
      const ageH = (now.getTime() - new Date(e.created_at).getTime()) / 3600000
      if (ageH > 6) crit++
      else if (ageH > 2) urg++
      else norm++
    }

    setHeroData({ criticos: crit, urgentes: urg, normales: norm, decisionesHoy: heroData.decisionesHoy })
    setTotalPending(draftsRes.count || 0)

    const draftData = topDraftRes.data as { id: string; trafico_id: string | null; company_id: string; draft_data: Record<string, unknown>; created_at: string; status: string } | null
    if (draftData) {
      const { data: companyRow } = await sb.from('companies').select('name').eq('company_id', draftData.company_id).maybeSingle()
      const company = companyRow as { name: string } | null
      setTopDraft({
        ...draftData,
        company_name: company?.name || draftData.company_id,
        draft_data: (draftData.draft_data || {}) as Record<string, unknown>,
      })
    } else {
      setTopDraft(null)
    }

    // Map operator names for activity
    const operators = props.opNames
    const actRows = (activityRes.data || []) as Array<{ id: string; operator_id: string; action_type: string; target_id: string | null; payload: Record<string, unknown> | null; created_at: string }>
    const mapped = actRows.map(a => ({
      ...a,
      operator_name: operators[a.operator_id] || 'Operador',
    }))
    setActivity(mapped)
    setIsLive(true)
  }, [heroData.decisionesHoy, props.opNames])

  // Realtime subscription
  useEffect(() => {
    const sb = createBrowserSupabaseClient()
    const channel = sb.channel('admin-cockpit')

    channel
      .on('postgres_changes' as 'system', { event: '*', schema: 'public', table: 'workflow_events' }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => refreshData(), 1000)
      })
      .on('postgres_changes' as 'system', { event: '*', schema: 'public', table: 'pedimento_drafts' }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => refreshData(), 1000)
      })
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      sb.removeChannel(channel)
    }
  }, [refreshData])

  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: TEXT_PRIMARY, minHeight: '100vh' }} className="p-4 md:px-7 md:py-6">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 36, height: 36, background: GOLD_GRADIENT,
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 900, color: '#0D0D0C', fontFamily: 'Georgia, serif',
          }}>Z</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Centro de Mando
          </h1>
        </div>
        <p style={{ color: TEXT_MUTED, fontSize: 13, margin: '4px 0 0 48px' }}>
          Aduana 240 Nuevo Laredo · <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtDate(new Date())}</span>
        </p>
      </div>

      {/* Hero strip */}
      <AdminHeroStrip {...heroData} />

      {/* Main: Action Engine + Right Rail */}
      <div style={{
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
        marginBottom: 20,
      }}>
        <style>{`
          @media (max-width: 1024px) {
            .admin-main-layout { flex-direction: column !important; }
            .admin-main-layout > * { flex: 1 1 100% !important; }
          }
        `}</style>
        <div className="admin-main-layout" style={{ display: 'flex', gap: 16, width: '100%', alignItems: 'flex-start' }}>
          <div style={{ flex: '3 1 0' }}>
            <ActionEngine
              draft={topDraft}
              onActionComplete={refreshData}
              totalPending={totalPending}
            />
          </div>
          <div style={{ flex: '2 1 0', minWidth: 280 }}>
            <AdminRightRail
              pipeline={props.pipeline}
              activity={activity}
              team={props.team}
              isLive={isLive}
            />
          </div>
        </div>
      </div>

      {/* Below fold — collapsible sections */}

      {/* Cartera de clientes */}
      <CollapsibleSection title="Cartera de clientes" badge={props.companies.length}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {['Cliente', 'Clave', 'Traficos', 'Salud', 'Ult. Sync', 'Alertas', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: TEXT_MUTED, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.companies.map(c => {
                const badge = healthBadge(c.health_score)
                return (
                  <tr key={c.company_id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: TEXT_SECONDARY, fontFamily: 'var(--font-mono)' }}>{c.clave_cliente || '\u2014'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{c.traficos_count.toLocaleString()}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{c.health_score}%</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: TEXT_MUTED, fontFamily: 'var(--font-mono)' }}>{c.last_sync ? fmtDateTime(c.last_sync) : '\u2014'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {c.alerts > 0 ? (
                        <span style={{ background: 'rgba(220,38,38,0.15)', color: RED, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{c.alerts}</span>
                      ) : (
                        <span style={{ color: GREEN, fontSize: 12 }}>0</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <Link href={`/?company=${c.company_id}`} style={{ color: GOLD, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Ver ZAPATA AI</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {/* Equipo */}
      <CollapsibleSection title="Equipo (7 dias)" badge={props.leaderboard.length} hidden={props.leaderboard.length === 0}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', color: TEXT_MUTED, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Operador</th>
              <th style={{ padding: '10px 14px', textAlign: 'center', color: TEXT_MUTED, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Rol</th>
              <th style={{ padding: '10px 14px', textAlign: 'center', color: TEXT_MUTED, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Acciones</th>
              <th style={{ padding: '10px 14px', textAlign: 'center', color: TEXT_MUTED, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Votos</th>
              <th style={{ padding: '10px 14px', textAlign: 'center', color: TEXT_MUTED, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Asignaciones</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', color: TEXT_MUTED, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Ult. activo</th>
            </tr>
          </thead>
          <tbody>
            {props.leaderboard.map((op, i) => (
              <tr key={op.id} style={{ borderBottom: i < props.leaderboard.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{op.full_name}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: TEXT_SECONDARY }}>{op.role}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: GOLD }}>{op.totalActions}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{op.classifications}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{op.assignments}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: TEXT_SECONDARY, fontSize: 11 }}>{op.lastActiveAt ? fmtDateTime(op.lastActiveAt) : '\u2014'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CollapsibleSection>

      {/* Workflow e integraciones */}
      <CollapsibleSection title="Workflow 24h" badge={`${props.totalWfEvents} eventos`} hidden={props.totalWfEvents === 0}>
        {props.stuckCount > 0 && (
          <div style={{ padding: '10px 16px', borderLeft: `4px solid ${RED}`, background: 'rgba(220,38,38,0.08)', fontSize: 13, fontWeight: 600, color: RED }}>
            {props.stuckCount} evento{props.stuckCount > 1 ? 's' : ''} atorado{props.stuckCount > 1 ? 's' : ''} — el mas antiguo tiene {props.oldestStuckMin} min
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {['Workflow', 'Total', 'Completados', 'Fallidos', 'Pendientes', 'Tasa'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: TEXT_MUTED, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.workflowStats.map(stats => {
                const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
                const badge = healthBadge(rate)
                return (
                  <tr key={stats.workflow} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{(WORKFLOW_LABELS as Record<string, string>)[stats.workflow] || stats.workflow}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{stats.total}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)', color: GREEN }}>{stats.completed}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)', color: stats.failed > 0 ? RED : TEXT_MUTED }}>{stats.failed}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{stats.total - stats.completed - stats.failed}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{rate}%</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {/* Traficos atascados */}
      <CollapsibleSection title="Traficos atascados (> 48h)" badge={props.stuckTraficos.length} hidden={props.stuckTraficos.length === 0}>
        <div style={{ padding: '8px 12px' }}>
          {props.stuckTraficos.map(t => {
            const ageMs = ageMsSince(t.created_at)
            const isOld = ageMs > 72 * 3600000
            const assignedName = t.assigned_to_operator_id ? (props.opNames[t.assigned_to_operator_id] || 'Asignado') : 'Sin asignar'
            return (
              <Link key={t.id} href={`/embarques/${t.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8, textDecoration: 'none', color: 'inherit',
                borderLeft: `3px solid ${isOld ? RED : AMBER}`,
                marginBottom: 6, background: 'rgba(255,255,255,0.02)',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: isOld ? RED : AMBER }}>{t.trafico}</span>
                <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>{t.company_id}</span>
                {t.importe_total && (
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: TEXT_SECONDARY }}>${Number(t.importe_total).toLocaleString()} USD</span>
                )}
                <span style={{ fontSize: 10, color: TEXT_MUTED, marginLeft: 'auto' }}>{fmtDateTime(t.created_at)}</span>
                <span style={{ fontSize: 10, color: TEXT_SECONDARY }}>{assignedName}</span>
                <span onClick={e => e.preventDefault()}>
                  <ChaserButton
                    traficoId={t.id}
                    traficoNum={t.trafico}
                    operatorEmail={t.assigned_to_operator_id ? (props.opEmails[t.assigned_to_operator_id] || null) : null}
                    operatorName={t.assigned_to_operator_id ? (props.opNames[t.assigned_to_operator_id] || null) : null}
                    companyId={t.company_id}
                  />
                </span>
              </Link>
            )
          })}
        </div>
      </CollapsibleSection>

      {/* Clasificaciones recientes */}
      <CollapsibleSection title="Clasificaciones recientes" badge={props.recentClassifications.length} hidden={props.recentClassifications.length === 0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 750 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {['Cliente', 'Cve Producto', 'Fraccion', 'Fuente', 'Descripcion', 'Clasificado'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: TEXT_MUTED, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.recentClassifications.map((p, i) => {
                const sb = sourceBadge(p.fraccion_source)
                return (
                  <tr key={`${p.company_id}-${p.cve_producto}-${i}`} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600 }}>{p.company_id}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font-mono)', color: TEXT_SECONDARY, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cve_producto || '\u2014'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: GOLD }}>{p.fraccion}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: sb.bg, color: sb.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{sb.label}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: TEXT_SECONDARY, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descripcion || '\u2014'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: TEXT_MUTED, fontFamily: 'var(--font-mono)' }}>{p.fraccion_classified_at ? fmtDateTime(p.fraccion_classified_at) : '\u2014'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {/* Cobertura de productos */}
      <CollapsibleSection title="Cobertura de productos" badge={props.syncCoverage.length} hidden={props.syncCoverage.length === 0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {['Cliente', 'Total Productos', 'Con Fraccion', 'Con Descripcion', 'Cobertura'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: TEXT_MUTED, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.syncCoverage.map(s => {
                const coveragePct = s.total > 0 ? Math.round((s.withFraccion / s.total) * 100) : 0
                const badge = healthBadge(coveragePct)
                return (
                  <tr key={s.company_id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{s.total.toLocaleString()}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{s.withFraccion.toLocaleString()}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{s.withDescripcion.toLocaleString()}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{coveragePct}% ({s.withFraccion.toLocaleString()} de {s.total.toLocaleString()})</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>
    </div>
  )
}
