import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import type { Landmark, LandmarkId, LandmarkType } from '@/types/corridor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// P0-A4: explicit service-role requirement. corridor_landmarks is
// reference data (no tenant column) but anon writes are revoked by
// the P0-A1 migration — service role is the only path.
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY required for /api/corridor/landmarks')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SERVICE_ROLE
)

interface LandmarkRow {
  id: string
  name: string
  type: string
  lat: number | string
  lng: number | string
  description: string | null
}

function toLandmark(row: LandmarkRow): Landmark {
  return {
    id: row.id as LandmarkId,
    name: row.name,
    type: row.type as LandmarkType,
    lat: typeof row.lat === 'string' ? parseFloat(row.lat) : row.lat,
    lng: typeof row.lng === 'string' ? parseFloat(row.lng) : row.lng,
    description: row.description,
  }
}

export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
      { status: 401 }
    )
  }

  const { data, error } = await supabase
    .from('corridor_landmarks')
    .select('id, name, type, lat, lng, description')
    .order('id', { ascending: true })

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  const rows = (data ?? []) as LandmarkRow[]
  const landmarks = rows.map(toLandmark)
  return NextResponse.json({ data: { landmarks }, error: null })
}
