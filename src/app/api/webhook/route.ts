import { NextRequest, NextResponse } from 'next/server'

// V1 security fix — hardcoded fallback removed. If WEBHOOK_SECRET isn't
// configured on the environment, the endpoint rejects every request rather
// than leaking a predictable default.
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

const ALLOWED_SCRIPTS = [
  'morning-report', 'entradas-anomaly', 'proveedor-intelligence',
  'fraccion-intelligence', 'weekly-executive-summary', 'anomaly-baseline',
  'globalpc-sync', 'database-backup',
]

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== WEBHOOK_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { script } = await request.json()
  if (!ALLOWED_SCRIPTS.includes(script)) return NextResponse.json({ error: `Script '${script}' not allowed` }, { status: 400 })

  // Note: exec won't work on Vercel serverless — this endpoint is for
  // local Throne or self-hosted usage. On Vercel it just validates the request.
  return NextResponse.json({ triggered: true, script, note: 'Run locally on Throne via n8n', timestamp: new Date().toISOString() })
}
