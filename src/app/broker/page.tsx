'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'
import { STAFF, getStaffConfig, buildSummary, buildSubtitle, type OpsMetrics } from '@/lib/ops-roles'
import { BrokerKPIs } from '@/components/broker/BrokerKPIs'
import { BrokerClients } from '@/components/broker/BrokerClients'
import { BrokerTools } from '@/components/broker/BrokerTools'

const T = {
  gold: 'var(--gold)',
  border: 'var(--border)',
  text: 'var(--text-primary)',
  textSec: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
} as const

interface Company {
  company_id: string
  name: string
  clave_cliente: string
  trafico_count: number
  valor_ytd: number
}

interface Pendiente {
  company_name: string
  company_id: string
  solicitudes_vencidas: number
  entradas_sin_trafico: number
}

interface HeartbeatEntry {
  created_at: string
  all_ok: boolean
  pm2_ok: boolean
  supabase_ok: boolean
  vercel_ok: boolean
  sync_ok: boolean
  sync_age_hours: number | null
  details: Record<string, string>
}

interface IntelligenceStats {
  total_today: number
  by_account: Record<string, number>
}

export default function BrokerCommandCenter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const staffParam = searchParams.get('staff')
  const [activeStaff, setActiveStaff] = useState(staffParam || 'tito')
  const staffConfig = getStaffConfig(activeStaff)
  const isMobile = useIsMobile()
  const [role, setRole] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [pendientes, setPendientes] = useState<Pendiente[]>([])
  const [heartbeat, setHeartbeat] = useState<HeartbeatEntry | null>(null)
  const [intelligence, setIntelligence] = useState<IntelligenceStats | null>(null)
  const [opsMetrics, setOpsMetrics] = useState<OpsMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  // Auth check
  useEffect(() => {
    const match = document.cookie.match(/(^| )user_role=([^;]+)/)
    const r = match ? match[2] : null
    setRole(r)
    if (r !== 'broker' && r !== 'admin') {
      router.replace('/')
    }
  }, [router])

  // Fetch all data
  useEffect(() => {
    if (role !== 'broker' && role !== 'admin') return
    loadData()
  }, [role])

  async function loadData() {
    setLoading(true)
    try {
      const [companiesRes, heartbeatRes, intelligenceRes, opsRes] = await Promise.all([
        fetch('/api/broker/data'),
        fetch('/api/broker/data?section=heartbeat'),
        fetch('/api/broker/data?section=intelligence'),
        fetch('/api/broker/data?section=ops-center'),
      ])

      const companiesData = await companiesRes.json()
      const heartbeatData = await heartbeatRes.json()
      const intelligenceData = await intelligenceRes.json()
      const opsData = await opsRes.json()

      if (companiesData.companies) setCompanies(companiesData.companies)
      if (companiesData.pendientes) setPendientes(companiesData.pendientes)
      if (heartbeatData.heartbeat) setHeartbeat(heartbeatData.heartbeat)
      if (intelligenceData.intelligence) setIntelligence(intelligenceData.intelligence)
      if (opsData.exceptionsToday !== undefined) setOpsMetrics(opsData as OpsMetrics)
    } catch {
      // Silent -- data will show empty states
    } finally {
      setLoading(false)
    }
  }

  async function viewAsClient(companyId: string) {
    const res = await fetch('/api/auth/view-as', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId }),
    })
    if (res.ok) {
      router.push('/')
    }
  }

  if (role !== 'broker' && role !== 'admin') return null

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Operations Center Header */}
      <div style={{ marginBottom: 32 }}>
        {/* Role pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {Object.values(STAFF).map(s => (
            <button
              key={s.id}
              onClick={() => setActiveStaff(s.id)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 'var(--aguila-fs-compact)', fontWeight: activeStaff === s.id ? 700 : 500,
                background: activeStaff === s.id ? 'rgba(196,150,60,0.1)' : 'var(--bg-card)',
                border: `1px solid ${activeStaff === s.id ? T.gold : T.border}`,
                color: activeStaff === s.id ? T.gold : T.textSec,
                cursor: 'pointer',
              }}
            >
              {s.name} · {s.title}
            </button>
          ))}
        </div>

        {/* Summary */}
        <h1 style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 700, color: T.text, margin: '0 0 4px' }}>
          {opsMetrics ? buildSummary(staffConfig, opsMetrics) : 'Centro de Operaciones'}
        </h1>
        {opsMetrics && (
          <p style={{ fontSize: 'var(--aguila-fs-body)', color: T.textSec, margin: 0 }}>
            {buildSubtitle(staffConfig, opsMetrics)}
          </p>
        )}
      </div>

      {/* Role-specific KPIs + learnings/inactive */}
      {opsMetrics && !loading && (
        <BrokerKPIs staffConfig={staffConfig} opsMetrics={opsMetrics} />
      )}

      <div>
        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
              {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 8 }} />)}
            </div>
            {[0, 1, 2, 3].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 48, borderRadius: 4 }} />)}
          </div>
        ) : (
          <>
            <BrokerClients
              companies={companies}
              pendientes={pendientes}
              isMobile={isMobile}
              onViewAsClient={viewAsClient}
            />
            <BrokerTools
              heartbeat={heartbeat}
              intelligence={intelligence}
              isMobile={isMobile}
            />
          </>
        )}
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
