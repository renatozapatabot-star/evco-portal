import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { getErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const LAREDO_BRIDGES = [
  { id: 1, name: 'World Trade Bridge', nameEs: 'Puente del Comercio Mundial', portNumber: '2304' },
  { id: 2, name: 'Colombia Solidarity Bridge', nameEs: 'Puente Colombia Solidaridad', portNumber: '2309' },
  { id: 3, name: 'Laredo-Lincoln Bridge', nameEs: 'Puente Lincoln-Juárez', portNumber: '2305' },
  { id: 4, name: 'Gateway to the Americas', nameEs: 'Puente Gateway', portNumber: '2303' },
]

export async function GET() {
  try {
    const res = await fetch('https://bwt.cbp.gov/api/bwtwaittimes', {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 900 }, // 15 min cache
    })

    if (!res.ok) throw new Error(`CBP API ${res.status}`)
    const data = await res.json()

    const bridges = LAREDO_BRIDGES.map(bridge => {
      const cbpData = (data || []).find((d: Record<string, unknown>) =>
        String(d.port_number) === bridge.portNumber ||
        String(d.port_name || '').toLowerCase().includes('laredo') && String(d.crossing_name || '').toLowerCase().includes(bridge.name.split(' ')[0].toLowerCase())
      )

      if (!cbpData) {
        return { ...bridge, status: 'unknown', commercial: null, passenger: null, pedestrian: null, updated: null }
      }

      const commercial = cbpData.commercial_vehicle_lanes?.standard_lanes?.delay_minutes ?? cbpData.comm_lanes_delay ?? null
      const passenger = cbpData.passenger_vehicle_lanes?.standard_lanes?.delay_minutes ?? cbpData.pass_lanes_delay ?? null
      const pedestrian = cbpData.pedestrian_lanes?.standard_lanes?.delay_minutes ?? cbpData.ped_lanes_delay ?? null

      return {
        ...bridge,
        commercial, passenger, pedestrian,
        status: commercial === null ? 'unknown' : commercial <= 30 ? 'green' : commercial <= 60 ? 'amber' : 'red',
        updated: cbpData.updated_at || cbpData.date || new Date().toISOString(),
      }
    })

    const recommended = bridges.filter(b => b.commercial !== null).sort((a, b) => (a.commercial || 999) - (b.commercial || 999))[0]?.id || null

    return NextResponse.json({ bridges, recommended, fetched: new Date().toISOString() })
  } catch (e: unknown) {
    // Fallback with simulated data when CBP API is down
    return NextResponse.json({
      bridges: LAREDO_BRIDGES.map(b => ({ ...b, commercial: null, passenger: null, pedestrian: null, status: 'unknown', updated: null })),
      recommended: null, fetched: new Date().toISOString(), error: getErrorMessage(e),
    })
  }
}
