'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Brain } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { D } from '@/components/intelligence/IntelShared'
import type { Stats, TierCounts, SandboxRow, ShadowRow } from '@/components/intelligence/IntelShared'
import { IntelKPISection, IntelTiersSection } from '@/components/intelligence/IntelKPIs'
import { ModelPerformanceTable, ShadowPredictionsTable } from '@/components/intelligence/IntelTables'

/* ── Page ─────────────────────────────────────────────────── */

export default function IntelligenceSandbox() {
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)
  const [tiers, setTiers] = useState<TierCounts | null>(null)
  const [sandbox, setSandbox] = useState<SandboxRow[]>([])
  const [shadowLog, setShadowLog] = useState<ShadowRow[]>([])

  // Auth gate — broker/admin only
  useEffect(() => {
    const match = document.cookie.match(/(^| )user_role=([^;]+)/)
    const r = match ? match[2] : null
    setRole(r)
    if (r !== 'broker' && r !== 'admin') {
      router.replace('/')
    }
  }, [router])

  // Fetch data
  useEffect(() => {
    if (role !== 'broker' && role !== 'admin') return
    fetchData()
  }, [role])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch('/api/intelligence/data')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setStats(data.stats)
      setTiers(data.tiers)
      setSandbox(data.sandbox || [])
      setShadowLog(data.shadowLog || [])
    } catch {
      // Will show empty states
    } finally {
      setLoading(false)
    }
  }

  if (role !== 'broker' && role !== 'admin') return null

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-8"
      style={{ background: D.bg, color: D.text }}
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className={`mb-8 flex ${isMobile ? 'flex-col' : 'items-center'} gap-3`}>
          <Brain size={28} style={{ color: D.gold }} />
          <div>
            <h1
              className="text-2xl font-semibold"
              style={{ color: D.text }}
            >
              Sandbox de Inteligencia
            </h1>
            <p className="text-sm" style={{ color: D.textSec }}>
              Patente 3596 · 32,299 traficos · 2011–2026
            </p>
          </div>
          <div
            className={`${isMobile ? '' : 'ml-auto'} rounded-full px-3 py-1 text-xs font-medium w-fit`}
            style={{
              background: D.goldSubtle,
              color: D.gold,
              border: `1px solid ${D.goldBorder}`,
            }}
          >
            SANDBOX
          </div>
        </div>

        {/* KPI Stats */}
        <IntelKPISection stats={stats} loading={loading} />

        {/* Model Performance */}
        <ModelPerformanceTable sandbox={sandbox} loading={loading} />

        {/* Training Tiers */}
        <IntelTiersSection tiers={tiers} loading={loading} />

        {/* Shadow Predictions */}
        <ShadowPredictionsTable shadowLog={shadowLog} stats={stats} loading={loading} />

        {/* Footer */}
        <p className="text-center text-xs" style={{ color: D.textMuted }}>
          Patente 3596 · Aduana 240 · Sandbox Mode — No client-facing output
        </p>
      </div>
    </div>
  )
}
