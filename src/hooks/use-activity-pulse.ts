'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getCompanyIdCookie } from '@/lib/client-config'

const sbClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export interface PulseItem {
  id: string
  text: string
  timestamp: string
  href: string
  color: string
}

interface AwaySummary {
  total: number
  events: number
  solicitudes: number
  docs: number
}

function describeWorkflowEvent(workflow: string, eventType: string, payload: Record<string, unknown>): string {
  const docType = (payload?.docType as string) || ''
  const filename = (payload?.filename as string) || ''
  switch (`${workflow}.${eventType}`) {
    case 'intake.email_processed': return `RZ procesó email${filename ? `: ${filename}` : ''}`
    case 'classify.product_needs_classification': return 'Producto pendiente de clasificación'
    case 'docs.completeness_check': return `Revisión de documentos${docType ? `: ${docType.replace(/_/g, ' ')}` : ''}`
    case 'docs.document_received': return `Documento recibido${docType ? `: ${docType.replace(/_/g, ' ')}` : ''}`
    default: return `${workflow}: ${eventType.replace(/_/g, ' ')}`
  }
}

function describeAgentDecision(triggerType: string, decision: string, action: string): string {
  if (triggerType === 'solicitation_overdue' && decision === 'escalation_queued') {
    const match = action.match(/(\d+) docs/)
    return `RZ escaló ${match?.[1] || ''} documentos pendientes`
  }
  return `CRUZ: ${decision.replace(/_/g, ' ')}`
}

export function useActivityPulse() {
  const [freshPulse, setFreshPulse] = useState<PulseItem[]>([])
  const [allPulse, setAllPulse] = useState<PulseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [awaySummary, setAwaySummary] = useState<AwaySummary | null>(null)

  const loadPulse = useCallback(async () => {
    const companyId = getCompanyIdCookie()
    if (!companyId) return

    const [weRes, adRes, dsRes] = await Promise.all([
      sbClient.from('workflow_events')
        .select('id, workflow, event_type, payload, created_at, trigger_id')
        .eq('company_id', companyId).eq('status', 'completed')
        .order('created_at', { ascending: false }).limit(10),
      sbClient.from('agent_decisions')
        .select('id, trigger_type, decision, action_taken, confidence, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }).limit(5),
      sbClient.from('documento_solicitudes')
        .select('id, trafico_id, doc_type, status, solicitado_at, recibido_at')
        .eq('company_id', companyId)
        .order('solicitado_at', { ascending: false }).limit(5),
    ])

    const items: PulseItem[] = []

    for (const e of (weRes.data || [])) {
      items.push({
        id: `we-${e.id}`,
        text: describeWorkflowEvent(e.workflow, e.event_type, e.payload || {}),
        timestamp: e.created_at,
        href: e.trigger_id ? `/embarques/${encodeURIComponent(e.trigger_id)}` : '/embarques',
        color: 'var(--success)',
      })
    }

    for (const d of (adRes.data || [])) {
      items.push({
        id: `ad-${d.id}`,
        text: describeAgentDecision(d.trigger_type, d.decision, d.action_taken || ''),
        timestamp: d.created_at,
        href: '/embarques',
        color: '#0D9488',
      })
    }

    for (const s of (dsRes.data || [])) {
      const docName = (s.doc_type || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
      if (s.status === 'recibido' && s.recibido_at) {
        items.push({
          id: `ds-r-${s.id}`,
          text: `Recibido: ${docName} de ${s.trafico_id}`,
          timestamp: s.recibido_at,
          href: `/embarques/${encodeURIComponent(s.trafico_id)}`,
          color: 'var(--success)',
        })
      } else {
        items.push({
          id: `ds-${s.id}`,
          text: `RZ solicitó ${docName} para ${s.trafico_id}`,
          timestamp: s.solicitado_at,
          href: `/embarques/${encodeURIComponent(s.trafico_id)}`,
          color: 'var(--gold)',
        })
      }
    }

    const seen = new Set<string>()
    const unique = items.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true })
    unique.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    const top10 = unique.slice(0, 10)
    setAllPulse(top10)
    // Filter fresh items (< 24h) inside callback to avoid Date.now() in render
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    setFreshPulse(top10.filter(item => item.timestamp > cutoff24h))
    setLoading(false)

    // "While you were away"
    const lastVisit = typeof window !== 'undefined' ? localStorage.getItem('cruz-last-visit') : null
    if (lastVisit) {
      const sinceEvents = (weRes.data || []).filter(e => e.created_at > lastVisit).length
      const sinceDecisions = (adRes.data || []).filter(d => d.created_at > lastVisit).length
      const sinceSolicitudes = (dsRes.data || []).filter(s => s.solicitado_at > lastVisit).length
      const total = sinceEvents + sinceDecisions + sinceSolicitudes
      if (total > 0) {
        setAwaySummary({ total, events: sinceEvents, solicitudes: sinceSolicitudes, docs: sinceDecisions })
      }
    }
  }, [])

  useEffect(() => {
    loadPulse()
    const interval = setInterval(loadPulse, 7_200_000) // 2 hours
    return () => clearInterval(interval)
  }, [loadPulse])

  return { pulse: freshPulse, allPulse, loading, awaySummary, dismissAway: () => setAwaySummary(null) }
}
