/**
 * PORTAL · Tráfico US — admin/broker-only foundation for US-side operator surface.
 *
 * Phase A is read-only. Source of truth is `traficos.fecha_cruce IS NOT NULL` —
 * the ONLY column today that tells us a shipment left Mexican customs.
 * US-side state (clearance, warehouse receipt, delivery) is stubbed elsewhere
 * but NOT populated, so this surface refuses to fabricate it. Empty buckets
 * render honest copy, never fake placeholders.
 *
 * Three buckets by crossing recency:
 *   - Recién cruzado (< 48h)    actionable right now
 *   - Esta semana   (2–7 días)  still warm
 *   - Últimos 30 días           reference
 *
 * Gating: requireOwner() — admin + broker only. No new operator-us role
 * until Tito authorizes (Phase B).
 */

import { createClient } from '@supabase/supabase-js'
import { requireOwner } from '@/lib/route-guards'
import { CockpitBrandHeader } from '@/components/brand/CockpitBrandHeader'
import { CockpitBackdrop } from '@/components/cockpit/shared/CockpitBackdrop'
import { COCKPIT_CANVAS } from '@/lib/design-system'
import { softData } from '@/lib/cockpit/safe-query'
import { TraficoUsClient, type TraficoUsRow } from './TraficoUsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SELECT_COLUMNS =
  'trafico, pedimento, fecha_cruce, fecha_llegada, estatus, semaforo, company_id'

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

export default async function TraficoUsPage() {
  await requireOwner()

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date().toISOString()
  const twoDaysAgo = isoDaysAgo(2)
  const sevenDaysAgo = isoDaysAgo(7)
  const thirtyDaysAgo = isoDaysAgo(30)

  const [recien, semana, historico] = await Promise.all([
    softData<TraficoUsRow>(
      sb
        .from('traficos')
        .select(SELECT_COLUMNS)
        .gte('fecha_cruce', twoDaysAgo)
        .lte('fecha_cruce', now)
        .order('fecha_cruce', { ascending: false })
        .limit(100),
      { label: 'traficos.us.recien' },
    ),
    softData<TraficoUsRow>(
      sb
        .from('traficos')
        .select(SELECT_COLUMNS)
        .gte('fecha_cruce', sevenDaysAgo)
        .lt('fecha_cruce', twoDaysAgo)
        .order('fecha_cruce', { ascending: false })
        .limit(100),
      { label: 'traficos.us.semana' },
    ),
    softData<TraficoUsRow>(
      sb
        .from('traficos')
        .select(SELECT_COLUMNS)
        .gte('fecha_cruce', thirtyDaysAgo)
        .lt('fecha_cruce', sevenDaysAgo)
        .order('fecha_cruce', { ascending: false })
        .limit(100),
      { label: 'traficos.us.historico' },
    ),
  ])

  return (
    <div
      className="aguila-dark"
      style={{
        position: 'relative',
        background: COCKPIT_CANVAS,
        minHeight: '100vh',
        padding: '24px 16px 48px',
        color: 'var(--portal-fg-1)',
        overflow: 'hidden',
      }}
    >
      <CockpitBackdrop />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        <CockpitBrandHeader
          subtitle="Tráfico US · Operadores"
          tagline="Lo que cruzó · lo que sigue del lado americano."
          markSize={48}
        />
        <TraficoUsClient
          recien={recien}
          semana={semana}
          historico={historico}
        />
      </div>
    </div>
  )
}
