import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { verifySession } from '@/lib/session'

// P0-A4: explicit service-role requirement. Outbound webhook
// management endpoint; tenant scope still enforced via session.
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY required for /api/webhooks')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SERVICE_ROLE
)

// GET — list subscriptions
export async function GET(req: NextRequest) {
  const getSessionToken = req.cookies.get('portal_session')?.value || ''
  const getSession = await verifySession(getSessionToken)
  if (!getSession) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } }, { status: 401 })
  }
  if (getSession.role !== 'broker' && getSession.role !== 'admin') {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Acceso restringido' } }, { status: 401 })
  }
  const companyId = getSession.companyId

  const { data } = await supabase.from('webhook_subscriptions')
    .select('id, company_id, url, events, active, created_at')
    .eq('active', true).eq('company_id', companyId).order('created_at', { ascending: false })
  return NextResponse.json({ subscriptions: data || [] })
}

// POST — subscribe or deliver
export async function POST(req: NextRequest) {
  const postSessionToken = req.cookies.get('portal_session')?.value || ''
  const postSession = await verifySession(postSessionToken)
  if (!postSession) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } }, { status: 401 })
  }
  if (postSession.role !== 'broker' && postSession.role !== 'admin') {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Acceso restringido' } }, { status: 401 })
  }
  const companyId = postSession.companyId
  const body = await req.json()

  // Subscribe
  if (body.action === 'subscribe') {
    const { url, events, secret } = body
    if (!url || !events?.length) return NextResponse.json({ error: 'url and events required' }, { status: 400 })
    const { data, error } = await supabase.from('webhook_subscriptions')
      .insert({ company_id: companyId, url, events, secret: secret || crypto.randomUUID() })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ subscription: data })
  }

  // Deliver event
  if (body.action === 'deliver') {
    const { event_type, payload } = body
    if (!event_type) return NextResponse.json({ error: 'event_type required' }, { status: 400 })

    const { data: subs } = await supabase.from('webhook_subscriptions')
      .select('*').eq('active', true).contains('events', [event_type])

    let delivered = 0
    for (const sub of (subs || [])) {
      const payloadStr = JSON.stringify({ event: event_type, data: payload, timestamp: new Date().toISOString() })
      const signature = crypto.createHmac('sha256', sub.secret || '').update(payloadStr).digest('hex')

      try {
        const res = await fetch(sub.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CRUZ-Signature': signature },
          body: payloadStr,
          signal: AbortSignal.timeout(10000),
        })
        await supabase.from('webhook_deliveries').insert({
          subscription_id: sub.id, event_type, payload, status: res.ok ? 'delivered' : 'failed',
          attempts: 1, delivered_at: res.ok ? new Date().toISOString() : null,
        })
        if (res.ok) delivered++
      } catch {
        await supabase.from('webhook_deliveries').insert({
          subscription_id: sub.id, event_type, payload, status: 'failed', attempts: 1,
        })
      }
    }
    return NextResponse.json({ delivered, total_subscriptions: subs?.length || 0 })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// DELETE — unsubscribe
export async function DELETE(req: NextRequest) {
  const delSessionToken = req.cookies.get('portal_session')?.value || ''
  const delSession = await verifySession(delSessionToken)
  if (!delSession) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } }, { status: 401 })
  }
  if (delSession.role !== 'broker' && delSession.role !== 'admin') {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Acceso restringido' } }, { status: 401 })
  }
  const companyId = delSession.companyId

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await supabase.from('webhook_subscriptions').update({ active: false }).eq('id', id).eq('company_id', companyId)
  return NextResponse.json({ ok: true })
}
