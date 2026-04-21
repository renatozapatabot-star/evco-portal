import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getErrorMessage } from '@/lib/errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST: Send WhatsApp message requesting docs
export async function POST(request: NextRequest) {
  try {
    const companyId = request.cookies.get('company_id')?.value ?? ''
    const { trafico_id, supplier_phone, missing_docs, message } = await request.json()

    if (!trafico_id || !supplier_phone) {
      return NextResponse.json({ error: 'trafico_id and supplier_phone required' }, { status: 400 })
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'

    if (!accountSid || !authToken) {
      return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 })
    }

    const toNumber = supplier_phone.startsWith('whatsapp:') ? supplier_phone : `whatsapp:${supplier_phone}`

    // Build message
    const body = message || `Hola. Soy CRUZ, el sistema de gestion de Renato Zapata & Company.\n\nPara el trafico *${trafico_id}*, necesitamos los siguientes documentos:\n\n${(missing_docs || []).map((d: string, i: number) => `${i + 1}. ${d}`).join('\n')}\n\nGracias,\nGrupo Aduanal Renato Zapata S.C. · Patente 3596`

    // Send via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const params = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: body,
    })

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const twilioData = await twilioRes.json()

    if (!twilioRes.ok) {
      return NextResponse.json({ error: twilioData.message || 'Twilio error' }, { status: 500 })
    }

    // Log conversation
    const { error: logError } = await supabase.from('whatsapp_conversations').insert({
      trafico_id,
      company_id: companyId,
      supplier_phone: toNumber,
      direction: 'outbound',
      message_body: body,
      status: 'sent',
      twilio_sid: twilioData.sid,
    })
    if (logError) console.error('[WhatsApp] Log error:', logError.message)

    return NextResponse.json({ success: true, sid: twilioData.sid })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
