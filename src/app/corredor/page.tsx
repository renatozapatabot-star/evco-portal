// Block 7 · Corridor Map — server shell for /corredor.
// Session-verifies then hands off to the dynamic-imported client map.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import type { Landmark, LandmarkId, LandmarkType } from '@/types/corridor'
import { CorridorPage } from './CorridorPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface LandmarkRow {
  id: string
  name: string
  type: string
  lat: number | string
  lng: number | string
  description: string | null
}

async function fetchLandmarks(): Promise<Landmark[]> {
  // P0-A4: explicit service-role requirement. corridor_landmarks is
  // reference data but anon writes are revoked by P0-A1 — this server
  // component must use service role.
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_ROLE) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY required for /corredor SSR')
  }
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SERVICE_ROLE,
  )
  const { data, error } = await sb
    .from('corridor_landmarks')
    .select('id, name, type, lat, lng, description')
    .order('id', { ascending: true })
  if (error || !data) return []
  return (data as LandmarkRow[]).map(r => ({
    id: r.id as LandmarkId,
    name: r.name,
    type: r.type as LandmarkType,
    lat: typeof r.lat === 'string' ? parseFloat(r.lat) : r.lat,
    lng: typeof r.lng === 'string' ? parseFloat(r.lng) : r.lng,
    description: r.description,
  }))
}

export default async function CorredorRoute() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const landmarks = await fetchLandmarks()
  return <CorridorPage landmarks={landmarks} companyId={session.companyId} role={session.role} />
}
