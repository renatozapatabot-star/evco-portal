import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/gmail/send
 * Body: { to, subject, body, replyToId?, threadId? }
 *
 * Sends email via Gmail API. Broker/admin only.
 * Logs to audit_log for compliance.
 */

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN_AI

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID || '',
      client_secret: GMAIL_CLIENT_SECRET || '',
      refresh_token: GMAIL_REFRESH_TOKEN || '',
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  const data = await res.json()
  return data.access_token
}

function buildRawEmail(to: string, subject: string, body: string, replyToId?: string, threadId?: string): string {
  const lines = [
    `To: ${to}`,
    `From: ai@renatozapata.com`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
  ]

  if (replyToId) {
    lines.push(`In-Reply-To: ${replyToId}`)
    lines.push(`References: ${replyToId}`)
  }

  lines.push('', body)

  const raw = lines.join('\r\n')
  return Buffer.from(raw).toString('base64url')
}

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session || (session.role !== 'broker' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    return NextResponse.json({ error: 'Gmail not configured' }, { status: 500 })
  }

  try {
    const { to, subject, body, replyToId, threadId } = await request.json()

    if (!to || !body) {
      return NextResponse.json({ error: 'to and body required' }, { status: 400 })
    }

    const token = await getAccessToken()
    const raw = buildRawEmail(to, subject || 'Re: Operaciones — Renato Zapata & Company', body, replyToId, threadId)

    const sendPayload: { raw: string; threadId?: string } = { raw }
    if (threadId) sendPayload.threadId = threadId

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sendPayload),
    })

    if (!sendRes.ok) {
      const errData = await sendRes.json()
      throw new Error(errData.error?.message || `Send failed: ${sendRes.status}`)
    }

    const result = await sendRes.json()

    // Audit log
    await supabase.from('audit_log').insert({
      action: 'gmail_send',
      details: { to, subject: subject || '(no subject)', messageId: result.id },
      user_id: session.companyId,
    }).then(() => {}, () => {})

    return NextResponse.json({ data: { id: result.id, threadId: result.threadId } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Gmail Send]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
