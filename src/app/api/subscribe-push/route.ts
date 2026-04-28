import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { resolveTenantScope } from '@/lib/api/tenant-scope'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // P0-A7: tenant of the push subscription comes from the signed
  // session, never from forgeable cookie or body field. Pre-fix a
  // client could subscribe under another tenant by setting
  // `company_id=other-tenant` cookie OR injecting it in the body.
  const companyId = resolveTenantScope(session, request)
  if (!companyId) return NextResponse.json({ error: 'Tenant scope required' }, { status: 400 })

  const { subscription } = await request.json()
  if (!subscription?.endpoint) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })

  const { error } = await supabase.from('push_subscriptions').upsert({
    company_id: companyId,
    endpoint: subscription.endpoint,
    auth: subscription.keys?.auth,
    p256dh: subscription.keys?.p256dh,
  }, { onConflict: 'endpoint' })

  return NextResponse.json({ success: !error })
}
