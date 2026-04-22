/**
 * Calm-tone + k-anon contract test for TradeIndexCard.
 *
 * Locks three rules from client-accounting-ethics.md + tenant-isolation.md:
 *
 *   1. No red/amber dunning tokens in the rendered output.
 *      The whole card renders in silver chrome — any regression that
 *      introduces --portal-status-red, var(--aguila-red), or literal
 *      warning hex values is a SEV-2.
 *
 *   2. When meets_k_anon=false, the card renders a friendly stub
 *      ("Comparación próximamente") and NEVER surfaces the fleet p10/p90
 *      numbers — those could be back-inferred against a tiny cohort.
 *
 *   3. When has_data=false, the card renders "Aún no hay datos
 *      suficientes" — no numbers at all.
 *
 *   4. Percentile text uses the calm phrasing "Más rápido que el X%"
 *      (factual) — never accusatory ("lento", "peor").
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TradeIndexCard } from '../TradeIndexCard'
import type { ClientPosition } from '@/lib/trade-index/query'

const emptyPosition: ClientPosition = {
  has_data: false,
  meets_k_anon: false,
  client: {
    shipment_count: 0,
    avg_clearance_days: null,
    percentile: null,
    tmec_rate: null,
    total_value_usd: null,
  },
  fleet: {
    avg_clearance_days: null,
    median_clearance_days: null,
    p10_clearance_days: null,
    p90_clearance_days: null,
    sample_size: null,
  },
  period: null,
  k_anon_lane_count: 0,
}

const kAnonFailPosition: ClientPosition = {
  has_data: true,
  meets_k_anon: false,
  client: {
    shipment_count: 12,
    avg_clearance_days: 2.4,
    percentile: null,
    tmec_rate: 0.85,
    total_value_usd: 500_000,
  },
  fleet: {
    avg_clearance_days: null,
    median_clearance_days: null,
    p10_clearance_days: null,
    p90_clearance_days: null,
    sample_size: null,
  },
  period: '2026-04-22',
  k_anon_lane_count: 0,
}

const healthyPosition: ClientPosition = {
  has_data: true,
  meets_k_anon: true,
  client: {
    shipment_count: 42,
    avg_clearance_days: 2.4,
    percentile: 72,
    tmec_rate: 0.88,
    total_value_usd: 1_200_000,
  },
  fleet: {
    avg_clearance_days: 3.1,
    median_clearance_days: 2.9,
    p10_clearance_days: 1.2,
    p90_clearance_days: 5.5,
    sample_size: 500,
  },
  period: '2026-04-22',
  k_anon_lane_count: 1,
}

describe('TradeIndexCard · calm tone + k-anon gates', () => {
  it('renders an insufficient-data stub when has_data is false', () => {
    const { container } = render(<TradeIndexCard position={emptyPosition} isClient />)
    expect(screen.getByText(/aún no hay datos suficientes/i)).not.toBeNull()
    // No numbers: no percentile, no "d" day marker
    expect(container.textContent).not.toMatch(/\d+º/)
  })

  it('hides fleet p10/p90 when k-anon is not met, only shows client aggregate', () => {
    render(<TradeIndexCard position={kAnonFailPosition} isClient />)

    // Friendly wait message present
    expect(screen.getByText(/comparación próximamente/i)).not.toBeNull()

    // Client's own number surfaces
    expect(screen.getByText(/2\.4 d/)).not.toBeNull()

    // Fleet p10/p90 strings must NOT appear (no cross-tenant inference)
    expect(screen.queryByText(/Flota p10/)).toBeNull()
    expect(screen.queryByText(/Flota p90/)).toBeNull()
  })

  it('renders percentile + fleet bands when k-anon is met', () => {
    render(<TradeIndexCard position={healthyPosition} isClient />)

    // Percentile shown as "72º"
    expect(screen.getByText('72º')).not.toBeNull()
    // Calm copy
    expect(screen.getByText(/más rápido que el 72% de la flota/i)).not.toBeNull()
    // Fleet bands present
    expect(screen.getByText(/Flota p10 · 1\.2 d/)).not.toBeNull()
    expect(screen.getByText(/Flota p90 · 5\.5 d/)).not.toBeNull()
    // T-MEC row
    expect(screen.getByText(/88\.0%/)).not.toBeNull()
  })

  it('renders the Anabel Mensajería CTA for clients', () => {
    render(<TradeIndexCard position={healthyPosition} isClient />)
    const link = screen.getByRole('link', { name: /abrir chat/i })
    expect(link.getAttribute('href')).toBe('/mensajeria?to=anabel&topic=trade-index')
    expect(screen.getByText(/anabel te explica/i)).not.toBeNull()
  })

  it('does NOT render the Mensajería CTA for internal (non-client) viewers', () => {
    render(<TradeIndexCard position={healthyPosition} isClient={false} />)
    expect(screen.queryByText(/anabel te explica/i)).toBeNull()
  })

  it('renders no red/amber dunning tokens (silver-only contract)', () => {
    const { container } = render(<TradeIndexCard position={healthyPosition} isClient />)
    const html = container.innerHTML

    // Semantic red/amber tokens from the PORTAL design system
    expect(html).not.toMatch(/portal-status-red/i)
    expect(html).not.toMatch(/portal-status-amber/i)
    expect(html).not.toMatch(/--portal-red/i)
    expect(html).not.toMatch(/--portal-amber/i)

    // Raw danger-signalling hex values
    expect(html).not.toMatch(/#EF4444/i)
    expect(html).not.toMatch(/#FBBF24/i)
    expect(html).not.toMatch(/#F59E0B/i)
    expect(html).not.toMatch(/#CC1B2F/i)

    // Accusatory copy
    expect(html).not.toMatch(/\bVENCIDO\b/)
    expect(html).not.toMatch(/\bURGENTE\b/i)
    expect(html).not.toMatch(/\boverdue\b/i)
    expect(html).not.toMatch(/\blento\b/i)
  })
})
