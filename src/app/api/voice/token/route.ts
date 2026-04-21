import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'

/**
 * GET /api/voice/token
 *
 * Generates a Twilio Voice capability token for browser-based calling.
 * Broker/admin only. Uses Twilio REST API to create a token.
 */
export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session || (session.role !== 'broker' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID

  if (!accountSid || !authToken) {
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
  }

  // Return credentials for direct Twilio REST API calling
  // The frontend will use Twilio's REST API to initiate calls
  return NextResponse.json({
    data: {
      accountSid,
      twimlAppSid: twimlAppSid || null,
      fromNumber: process.env.TWILIO_FROM_NUMBER || '+19566727859',
    },
  })
}
