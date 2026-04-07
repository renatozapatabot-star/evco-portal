import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/voice/call
 * Body: { to, contactName?, traficoId?, notes? }
 *
 * Initiates a call via Twilio REST API.
 * Calls the user's phone first, then connects to the target.
 * Broker/admin only.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session || (session.role !== 'broker' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER || '+19566727859'

  if (!accountSid || !authToken) {
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
  }

  try {
    const { to, contactName, traficoId, notes } = await request.json()

    if (!to) {
      return NextResponse.json({ error: 'Phone number (to) required' }, { status: 400 })
    }

    // Clean phone number
    const cleanTo = to.replace(/[^+\d]/g, '')

    // TwiML that connects to the target number
    const twiml = `<Response><Dial callerId="${fromNumber}"><Number>${cleanTo}</Number></Dial></Response>`
    const twimlUrl = `http://twimlets.com/echo?Twiml=${encodeURIComponent(twiml)}`

    // Initiate call via Twilio REST API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`
    const params = new URLSearchParams({
      From: fromNumber,
      To: cleanTo,
      Url: twimlUrl,
    })

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const twilioData = await twilioRes.json()

    if (!twilioRes.ok) {
      throw new Error(twilioData.message || `Twilio error: ${twilioRes.status}`)
    }

    // Log the call
    await supabase.from('call_transcripts').insert({
      call_sid: twilioData.sid,
      phone_number: cleanTo,
      contact_name: contactName || null,
      trafico_id: traficoId || null,
      notes: notes || null,
      status: 'initiated',
      company_id: session.companyId,
      created_at: new Date().toISOString(),
    }).then(() => {}, () => {})

    return NextResponse.json({
      data: {
        callSid: twilioData.sid,
        status: twilioData.status,
        to: cleanTo,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Voice Call]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
