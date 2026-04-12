'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient as createBrowserSupabase } from '@/lib/supabase/client'
import { BG_GRADIENT_START, BG_GRADIENT_END } from '@/lib/design-system'
import { HeroStrip } from './HeroStrip'
import { PortfolioPulse } from './PortfolioPulse'
import { ClientHealthGrid } from './ClientHealthGrid'
import { RightRail } from './RightRail'
import type { InicioData } from './types'

export function InicioCockpit({ data }: { data: InicioData }) {
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const sb = createBrowserSupabase()
    const refresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => router.refresh(), 1000)
    }
    const channel = sb
      .channel('admin-inicio')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'traficos' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operational_decisions' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_events' }, refresh)
      .subscribe()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      sb.removeChannel(channel)
    }
  }, [router])

  return (
    <div
      className="aduana-dark"
      style={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${BG_GRADIENT_START} 0%, ${BG_GRADIENT_END} 100%)`,
        padding: '24px 16px',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: '#E6EDF3',
              letterSpacing: '-0.03em',
              margin: 0,
            }}
          >
            Inicio
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
            Portafolio de la correduría · Patente 3596
          </p>
        </header>

        <HeroStrip hero={data.hero} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 320px)',
            gap: 16,
            marginTop: 16,
          }}
          className="inicio-main-grid"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <PortfolioPulse pulse={data.pulse} />
            <ClientHealthGrid clients={data.clientHealth} />
          </div>
          <RightRail rail={data.rightRail} />
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          :global(.inicio-main-grid) {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </div>
  )
}
