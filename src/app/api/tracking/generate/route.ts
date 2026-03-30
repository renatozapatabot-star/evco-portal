import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { trafico_id } = body

    if (!trafico_id) {
      return NextResponse.json(
        { error: 'trafico_id es requerido' },
        { status: 400 }
      )
    }

    // Verify trafico exists
    const { data: trafico, error: trafError } = await supabase
      .from('traficos')
      .select('trafico')
      .eq('trafico', trafico_id)
      .single()

    if (trafError || !trafico) {
      return NextResponse.json(
        { error: 'Trafico no encontrado' },
        { status: 404 }
      )
    }

    // Check for existing active token
    const { data: existing } = await supabase
      .from('tracking_tokens')
      .select('token')
      .eq('trafico_id', trafico_id)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .single()

    if (existing) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
      return NextResponse.json({
        token: existing.token,
        url: `${baseUrl}/track/${existing.token}`,
        reused: true,
      })
    }

    // Generate new token
    const token = crypto.randomBytes(16).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30) // 30 day expiry

    const { error: insertError } = await supabase
      .from('tracking_tokens')
      .insert({
        token,
        trafico_id,
        expires_at: expiresAt.toISOString(),
        view_count: 0,
        created_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('Failed to create tracking token:', insertError)
      return NextResponse.json(
        { error: 'Error al crear enlace de rastreo' },
        { status: 500 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
    return NextResponse.json({
      token,
      url: `${baseUrl}/track/${token}`,
      expires_at: expiresAt.toISOString(),
    })
  } catch (err) {
    console.error('Tracking generate error:', err)
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    )
  }
}
