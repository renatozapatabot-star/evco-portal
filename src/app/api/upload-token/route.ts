import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 400 })

  const { data } = await supabase
    .from('upload_tokens')
    .select('*')
    .eq('token', token)
    .single()

  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (new Date(data.expires_at) < new Date()) return NextResponse.json({ error: 'expired' }, { status: 410 })

  await supabase.from('upload_tokens')
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq('token', token)

  // Resolve human-friendly client name (companies.name). Fail open — the
  // proveedor page falls back to company_id if the join returns nothing.
  let companyName: string | null = null
  if (data.company_id) {
    const { data: companyRow } = await supabase
      .from('companies')
      .select('name')
      .eq('company_id', data.company_id)
      .maybeSingle()
    companyName = (companyRow?.name as string | undefined) ?? null
  }

  return NextResponse.json({
    trafico_id: data.trafico_id,
    company_id: data.company_id,
    company_name: companyName,
    required_docs: data.required_docs || [],
    docs_received: data.docs_received || [],
    expires_at: data.expires_at,
    last_activity_at: data.updated_at || data.created_at || null,
    shipment_confirmed: !!data.shipment_confirmed_at,
    shipment_confirmed_at: data.shipment_confirmed_at || null,
  })
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  const token = formData.get('token') as string
  const traficoId = formData.get('trafico_id') as string
  const companyId = formData.get('company_id') as string

  if (!file || !token || !traficoId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Verify token
  const { data: tokenData } = await supabase
    .from('upload_tokens')
    .select('id, expires_at, docs_received')
    .eq('token', token)
    .single()

  if (!tokenData) return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
  if (new Date(tokenData.expires_at) < new Date()) return NextResponse.json({ error: 'Token expired' }, { status: 410 })

  // Upload to Supabase Storage
  const fileName = `${traficoId}/${Date.now()}-${file.name}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('expediente-documents')
    .upload(fileName, buffer, { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('expediente-documents')
    .getPublicUrl(fileName)

  // Save to documents table
  await supabase.from('documents').insert({
    trafico_id: traficoId,
    company_id: companyId,
    document_type: file.name.split('.')[0],
    file_url: urlData.publicUrl,
    file_name: file.name,
    source: 'supplier_upload',
    created_at: new Date().toISOString()
  })

  // Update token received docs
  const received = [...(tokenData.docs_received || []), file.name]
  await supabase.from('upload_tokens')
    .update({ docs_received: received })
    .eq('id', tokenData.id)

  // Notify via Telegram
  if (process.env.TELEGRAM_BOT_TOKEN) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: '-5085543275',
        text: `📄 Doc recibido — ${traficoId}\nArchivo: ${file.name}\nVía: Supplier Upload\n— ZAPATA AI 🦀`
      })
    }).catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) })
  }

  return NextResponse.json({ success: true, file_name: file.name })
}
