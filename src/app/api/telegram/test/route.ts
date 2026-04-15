/**
 * ZAPATA AI · V1.5 F12 — Telegram test send.
 *
 * Lets a user verify their routing config without waiting for a real
 * event. Sends a canned sample message per event kind to the supplied
 * chat_id. Respects TELEGRAM_SILENT=true and returns a clear error if
 * the bot token is not configured.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { ROUTABLE_EVENT_KINDS, formatForEvent } from '@/lib/telegram/formatters'

export const runtime = 'nodejs'

const BodySchema = z.object({
  chatId: z.string().min(1),
  eventKind: z.enum(ROUTABLE_EVENT_KINDS as unknown as [string, ...string[]]),
})

const SAMPLE_PAYLOADS: Record<string, Record<string, unknown>> = {
  trafico_completed: {
    trafico_id: 'TR-2284',
    client_name: 'EVCO',
    crossed_at: new Date().toISOString(),
    total_amount: 47200,
    currency: 'USD',
    operator_name: 'Eduardo',
    next_action: 'ninguna',
  },
  factura_issued: {
    invoice_number: 'F-9128',
    client_name: 'EVCO',
    amount: 12500,
    currency: 'MXN',
  },
  pece_payment_confirmed: {
    pedimento_number: '26 24 3596 6500441',
    amount: 98200,
    currency: 'MXN',
    bank_name: 'Banorte',
  },
  dormant_client_detected: {
    client_name: 'Hilos Iris',
    days_dormant: 42,
  },
  semaforo_verde: {
    trafico_id: 'TR-2284',
    lane: 'B4',
    bridge: 'World Trade',
  },
  mve_alert_raised: {
    pedimento_number: '26 24 3596 6500441',
    days_remaining: 5,
    severity: 'warning',
  },
}

export async function POST(req: NextRequest) {
  const c = await cookies()
  const role = c.get('user_role')?.value ?? ''
  if (!role) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
      { status: 401 },
    )
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 },
    )
  }

  if (process.env.TELEGRAM_SILENT === 'true') {
    return NextResponse.json({
      data: { sent: false, reason: 'silenced' },
      error: null,
    })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json(
      {
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'TELEGRAM_BOT_TOKEN no configurado' },
      },
      { status: 500 },
    )
  }

  const sample = SAMPLE_PAYLOADS[parsed.data.eventKind] ?? {}
  const text = `🧪 Prueba · ${formatForEvent(parsed.data.eventKind, sample)}`

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: parsed.data.chatId,
        text,
        parse_mode: 'HTML',
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json(
        { data: null, error: { code: 'INTERNAL_ERROR', message: errText.slice(0, 200) } },
        { status: 502 },
      )
    }
    return NextResponse.json({ data: { sent: true }, error: null })
  } catch (err) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    )
  }
}
