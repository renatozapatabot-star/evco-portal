import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { COMPANY_ID } from '@/lib/client-config'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  const { subscription, company_id = COMPANY_ID } = await request.json()
  if (!subscription?.endpoint) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })

  const { error } = await supabase.from('push_subscriptions').upsert({
    company_id,
    endpoint: subscription.endpoint,
    auth: subscription.keys?.auth,
    p256dh: subscription.keys?.p256dh,
  }, { onConflict: 'endpoint' })

  return NextResponse.json({ success: !error })
}
