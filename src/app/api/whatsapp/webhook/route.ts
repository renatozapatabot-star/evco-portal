import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getErrorMessage } from '@/lib/errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function twiml(message?: string): NextResponse {
  const xml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response/>`
  return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } })
}

// POST: Twilio webhook for incoming WhatsApp messages
export async function POST(request: NextRequest) {
  try {
    // P0-A7: Twilio's webhook never carries a `company_id` cookie — the
    // pre-fix read was always empty string and silently flowed into
    // INSERTs. Resolve the tenant from the matching trafico instead,
    // which is the only authoritative source on inbound webhook calls.
    const formData = await request.formData()
    const from = formData.get('From') as string || ''
    const body = formData.get('Body') as string || ''
    const numMedia = parseInt(formData.get('NumMedia') as string || '0', 10)

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN

    // Try to find the most recent trafico associated with this phone number,
    // and read its company_id at the same time so subsequent INSERTs are
    // tenant-scoped to the actual owner of the conversation.
    const { data: convoMatch } = await supabase
      .from('whatsapp_conversations')
      .select('trafico_id, company_id')
      .eq('supplier_phone', from)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const traficoId = convoMatch?.trafico_id || 'unknown'
    let companyId: string = (convoMatch?.company_id as string | undefined) ?? ''
    // Fall back: if no prior conversation row, look up the trafico itself.
    if (!companyId && traficoId && traficoId !== 'unknown') {
      const { data: trafRow } = await supabase
        .from('traficos')
        .select('company_id')
        .eq('trafico', traficoId)
        .maybeSingle()
      companyId = (trafRow?.company_id as string | undefined) ?? ''
    }

    // Handle media attachments
    if (numMedia > 0) {
      const mediaResults: string[] = []

      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = formData.get(`MediaUrl${i}`) as string
        const mediaType = formData.get(`MediaContentType${i}`) as string || 'application/octet-stream'

        if (!mediaUrl) continue

        try {
          // Download media from Twilio (requires basic auth)
          const fetchOptions: RequestInit = {}
          if (accountSid && authToken) {
            fetchOptions.headers = {
              'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
            }
          }
          const mediaRes = await fetch(mediaUrl, fetchOptions)
          if (!mediaRes.ok) {
            console.error(`[WhatsApp Webhook] Failed to download media ${i}: ${mediaRes.status}`)
            continue
          }

          const mediaBuffer = await mediaRes.arrayBuffer()
          const bytes = new Uint8Array(mediaBuffer)

          // Determine file extension from content type
          const extMap: Record<string, string> = {
            'application/pdf': 'pdf',
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'application/vnd.ms-excel': 'xls',
            'application/xml': 'xml',
            'text/xml': 'xml',
            'text/plain': 'txt',
          }
          const ext = extMap[mediaType] || 'bin'
          const timestamp = Date.now()
          const sanitizedPhone = from.replace(/[^0-9]/g, '')
          const fileName = `${traficoId}/whatsapp/${sanitizedPhone}_${timestamp}_${i}.${ext}`

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('expediente-documents')
            .upload(fileName, bytes, { contentType: mediaType, upsert: true })

          if (uploadError) {
            console.error(`[WhatsApp Webhook] Storage upload error: ${uploadError.message}`)
            continue
          }

          const fileUrl = supabase.storage
            .from('expediente-documents')
            .getPublicUrl(fileName).data.publicUrl

          // Save document record
          const { error: docError } = await supabase.from('expediente_documentos').insert({
            pedimento_id: traficoId,
            doc_type: 'whatsapp-upload',
            file_name: `${sanitizedPhone}_${timestamp}_${i}.${ext}`,
            file_url: fileUrl,
            uploaded_by: `whatsapp:${sanitizedPhone}`,
            uploaded_at: new Date().toISOString(),
            company_id: companyId,
          })
          if (docError) console.error(`[WhatsApp Webhook] DB insert error: ${docError.message}`)

          mediaResults.push(fileName)
        } catch (mediaErr: unknown) {
          console.error(`[WhatsApp Webhook] Media processing error: ${getErrorMessage(mediaErr)}`)
        }
      }

      // Log the inbound message with media
      const { error: mediaLogError } = await supabase.from('whatsapp_conversations').insert({
        trafico_id: traficoId,
        company_id: companyId,
        supplier_phone: from,
        direction: 'inbound',
        message_body: body || `[${numMedia} archivo(s) recibido(s)]`,
        status: 'received',
        media_urls: mediaResults,
      })
      if (mediaLogError) console.error('[WhatsApp Webhook] Media log error:', mediaLogError.message)

      return twiml('Recibimos tu documento. Gracias!')
    }

    // No media -- just a text message
    const { error: textLogError } = await supabase.from('whatsapp_conversations').insert({
      trafico_id: traficoId,
      company_id: companyId,
      supplier_phone: from,
      direction: 'inbound',
      message_body: body,
      status: 'received',
    })
    if (textLogError) console.error('[WhatsApp Webhook] Text log error:', textLogError.message)

    return twiml('Recibimos tu mensaje. Si necesitas enviar documentos, adjuntalos como archivo o foto.')
  } catch (error: unknown) {
    console.error('[WhatsApp Webhook] Error:', getErrorMessage(error))
    return twiml()
  }
}
