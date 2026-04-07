import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'

/**
 * GET /api/gmail?action=list&limit=20
 * GET /api/gmail?action=read&id=<messageId>
 *
 * Server-side Gmail API proxy. Uses OAuth tokens from env vars.
 * Only accessible to broker/admin role — clients never touch Gmail directly.
 */

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN_AI

interface GmailTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token
  }

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

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`)
  }

  const data: GmailTokenResponse = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return data.access_token
}

async function gmailFetch(path: string, token: string): Promise<Response> {
  return fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

function decodeBase64Url(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded, 'base64').toString('utf-8')
}

function extractBody(payload: { mimeType?: string; body?: { data?: string }; parts?: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }[] }): string {
  // Try to get text/plain first, then text/html
  if (payload.body?.data && payload.mimeType === 'text/plain') {
    return decodeBase64Url(payload.body.data)
  }

  if (payload.parts) {
    // Find text/plain
    const textPart = payload.parts.find(p => p.mimeType === 'text/plain')
    if (textPart?.body?.data) return decodeBase64Url(textPart.body.data)

    // Fallback to text/html (strip tags)
    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html')
    if (htmlPart?.body?.data) {
      const html = decodeBase64Url(htmlPart.body.data)
      return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000)
    }

    // Try multipart/alternative nested parts
    for (const part of payload.parts) {
      if (part.parts && Array.isArray(part.parts)) {
        const nested = extractBody(part as { mimeType?: string; body?: { data?: string }; parts?: { mimeType?: string; body?: { data?: string } }[] })
        if (nested) return nested
      }
    }
  }

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }

  return ''
}

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

export async function GET(request: NextRequest) {
  // Auth: broker/admin only
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session || (session.role !== 'broker' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    return NextResponse.json({ error: 'Gmail not configured' }, { status: 500 })
  }

  const action = request.nextUrl.searchParams.get('action')

  try {
    const token = await getAccessToken()

    if (action === 'list') {
      const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '20'), 50)
      const q = request.nextUrl.searchParams.get('q') || ''
      const queryParams = new URLSearchParams({
        maxResults: String(limit),
        ...(q ? { q } : {}),
      })

      const listRes = await gmailFetch(`messages?${queryParams}`, token)
      if (!listRes.ok) throw new Error(`Gmail list: ${listRes.status}`)
      const listData = await listRes.json()

      const messageIds: string[] = (listData.messages || []).map((m: { id: string }) => m.id)

      // Fetch metadata for each message (batch for performance)
      const metadataPromises = messageIds.slice(0, limit).map(async (id: string) => {
        const msgRes = await gmailFetch(`messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, token)
        if (!msgRes.ok) return null
        const msg = await msgRes.json()
        const headers = msg.payload?.headers || []
        return {
          id: msg.id,
          threadId: msg.threadId,
          from: getHeader(headers, 'From'),
          subject: getHeader(headers, 'Subject'),
          date: getHeader(headers, 'Date'),
          snippet: msg.snippet || '',
          labelIds: msg.labelIds || [],
          isUnread: (msg.labelIds || []).includes('UNREAD'),
        }
      })

      const messages = (await Promise.all(metadataPromises)).filter(Boolean)

      return NextResponse.json({ data: messages }, {
        headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
      })
    }

    if (action === 'read') {
      const id = request.nextUrl.searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

      const msgRes = await gmailFetch(`messages/${id}?format=full`, token)
      if (!msgRes.ok) throw new Error(`Gmail read: ${msgRes.status}`)
      const msg = await msgRes.json()

      const headers = msg.payload?.headers || []
      const body = extractBody(msg.payload || {})

      // Extract attachment info (not content)
      const attachments: { filename: string; mimeType: string; size: number; attachmentId: string }[] = []
      function findAttachments(parts: { filename?: string; mimeType?: string; body?: { size?: number; attachmentId?: string }; parts?: unknown[] }[]) {
        for (const part of parts) {
          if (part.filename && part.body?.attachmentId) {
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType || 'application/octet-stream',
              size: part.body.size || 0,
              attachmentId: part.body.attachmentId,
            })
          }
          if (part.parts && Array.isArray(part.parts)) {
            findAttachments(part.parts as typeof parts)
          }
        }
      }
      if (msg.payload?.parts) findAttachments(msg.payload.parts)

      return NextResponse.json({
        data: {
          id: msg.id,
          threadId: msg.threadId,
          from: getHeader(headers, 'From'),
          to: getHeader(headers, 'To'),
          subject: getHeader(headers, 'Subject'),
          date: getHeader(headers, 'Date'),
          body: body.substring(0, 5000),
          attachments,
          labelIds: msg.labelIds || [],
        },
      })
    }

    return NextResponse.json({ error: 'Unknown action. Use: list, read' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Gmail API]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
