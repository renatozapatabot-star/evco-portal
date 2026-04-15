import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { PORTAL_DATE_FROM } from '@/lib/data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Lookup token
  const { data: tokenRow, error: tokenError } = await supabase
    .from('tracking_tokens')
    .select('*')
    .eq('token', token)
    .single()

  if (tokenError || !tokenRow) {
    return NextResponse.json(
      { error: 'Token no encontrado o expirado' },
      { status: 404 }
    )
  }

  // Check expiration
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'Este enlace de rastreo ha expirado' },
      { status: 410 }
    )
  }

  // Fetch trafico data
  const { data: trafico, error: trafError } = await supabase
    .from('traficos')
    .select('trafico, estatus, descripcion_mercancia, fecha_llegada, transportista_mexicano, created_at, updated_at')
    .eq('trafico', tokenRow.trafico_id)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .single()

  if (trafError || !trafico) {
    return NextResponse.json(
      { error: 'Embarque no encontrado' },
      { status: 404 }
    )
  }

  // Increment view count (fire and forget)
  supabase
    .from('tracking_tokens')
    .update({ view_count: (tokenRow.view_count || 0) + 1, last_viewed_at: new Date().toISOString() })
    .eq('token', token)
    .then(() => {})

  // Map internal status to tracking status
  const statusRaw = (trafico.estatus || '').toLowerCase()
  let trackingStatus = 'IN_TRANSIT'
  let statusLabel = 'En Tránsito'

  if (statusRaw.includes('proceso') || statusRaw.includes('despacho')) {
    trackingStatus = 'CUSTOMS_CLEARANCE'
    statusLabel = 'Despacho Aduanal'
  } else if (statusRaw.includes('cruzado') || statusRaw.includes('liberado')) {
    trackingStatus = 'CLEARED'
    statusLabel = 'Cruzado'
  } else if (statusRaw.includes('entregado')) {
    trackingStatus = 'DELIVERED'
    statusLabel = 'Entregado'
  } else if (statusRaw.includes('frontera') || statusRaw.includes('border')) {
    trackingStatus = 'AT_BORDER'
    statusLabel = 'En Frontera'
  }

  // V1 · Spanish-primary per CLAUDE.md. External tracking page must match
  // brand voice (no mixed English/Spanish steps).
  const steps = [
    { key: 'DEPARTED_ORIGIN', label: 'Salió de origen', done: true },
    { key: 'ARRIVED_LAREDO', label: 'Llegó a Laredo', done: true },
    {
      key: 'CUSTOMS_CLEARANCE',
      label: 'Despacho aduanal',
      done: ['CUSTOMS_CLEARANCE', 'AT_BORDER', 'CLEARED', 'DELIVERED'].includes(trackingStatus),
    },
    {
      key: 'BORDER_CROSSING',
      label: 'Cruce fronterizo',
      done: ['CLEARED', 'DELIVERED'].includes(trackingStatus),
      active: trackingStatus === 'AT_BORDER' || trackingStatus === 'CUSTOMS_CLEARANCE',
    },
    {
      key: 'DELIVERED',
      label: 'Entregado',
      done: trackingStatus === 'DELIVERED',
    },
  ]

  // Estimate delivery (simple heuristic: 2 business days from last update)
  let estimatedDelivery: string | null = null
  if (trackingStatus !== 'DELIVERED') {
    const base = new Date(trafico.updated_at || trafico.created_at)
    base.setDate(base.getDate() + 2)
    // Skip weekends
    if (base.getDay() === 0) base.setDate(base.getDate() + 1)
    if (base.getDay() === 6) base.setDate(base.getDate() + 2)
    estimatedDelivery = base.toISOString().split('T')[0]
  }

  return NextResponse.json({
    reference: trafico.trafico,
    description: trafico.descripcion_mercancia,
    carrier: trafico.transportista_mexicano,
    status: trackingStatus,
    statusLabel,
    estimatedDelivery,
    steps,
    lastUpdated: trafico.updated_at,
  })
}
