/**
 * CRUZ · V1.5 F12 — Telegram dispatch.
 *
 * Looks up enabled routes in `telegram_routing` for a given event kind,
 * formats a message per-event via `formatters.ts`, and sends via
 * `sendTelegram`. Always fire-and-forget safe — never throws.
 *
 * Respects TELEGRAM_SILENT=true (via sendTelegram) and skips all work
 * when silent (so we don't query Supabase for no reason).
 *
 * Telemetry: on every successful dispatch (non-silent), we insert a
 * `metadata.event = 'telegram_dispatched'` row into `audit_log`.
 */

import { createClient } from '@supabase/supabase-js'
import { sendTelegram } from '@/lib/telegram'
import { ROUTABLE_EVENT_KINDS, formatForEvent, type FormatterPayload } from '@/lib/telegram/formatters'

type RoutingRow = { id: string; chat_id: string; user_id: string | null; company_id: string | null }

let warnedMissingEnv = false

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    if (!warnedMissingEnv) {
      warnedMissingEnv = true
      console.warn('[telegram/dispatch] Supabase env missing — skipping dispatch')
    }
    return null
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Look up every enabled route for `eventKind` and send the formatted
 * message. Silently swallows all errors — telegram delivery is never
 * on the critical path.
 */
export async function dispatchTelegramForEvent(
  eventKind: string,
  payload: FormatterPayload,
): Promise<void> {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!ROUTABLE_EVENT_KINDS.includes(eventKind)) return

  const sb = serviceClient()
  if (!sb) return

  try {
    const { data, error } = await sb
      .from('telegram_routing')
      .select('id, chat_id, user_id, company_id')
      .eq('event_kind', eventKind)
      .eq('enabled', true)
      .limit(200)

    if (error || !data || data.length === 0) return

    const message = formatForEvent(eventKind, payload)

    // Each route gets its own send. We use sendTelegram's default
    // chat_id path by temporarily overriding — but sendTelegram reads
    // TELEGRAM_CHAT_ID from env. To send per-route, we inline the fetch.
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      // Fall back to sendTelegram which will log the env warning once
      await sendTelegram(message)
      return
    }

    await Promise.all(
      (data as RoutingRow[]).map(async (route) => {
        try {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: route.chat_id,
              text: message,
              parse_mode: 'HTML',
            }),
          })
        } catch (err) {
          console.warn(
            '[telegram/dispatch] send failed:',
            err instanceof Error ? err.message : String(err),
          )
        }
      }),
    )

    // Telemetry — fire-and-forget, never block caller.
    try {
      await sb.from('audit_log').insert({
        action: 'telegram_dispatched',
        entity_type: 'telegram_routing',
        entity_id: eventKind,
        details: {
          event: 'telegram_dispatched',
          event_kind: eventKind,
          routes: data.length,
        },
      })
    } catch {
      /* swallow — telemetry is optional */
    }
  } catch (err) {
    console.warn(
      '[telegram/dispatch] unexpected error:',
      err instanceof Error ? err.message : String(err),
    )
  }
}

/**
 * Thin wrapper for hot paths: insert into `workflow_events` AND fire a
 * Telegram dispatch if the event kind is routable. Returns the insert
 * error (if any) so callers can surface it the same way they did before.
 *
 * Callers still pass their own supabase client to keep RLS context.
 */
export async function emitWorkflowEvent(
  supabase: {
    from: (table: string) => {
      insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
    }
  },
  row: {
    workflow: string
    event_type: string
    trigger_id?: string | null
    company_id: string
    payload?: Record<string, unknown>
    status?: string
  },
  options?: { dispatchKind?: string; dispatchPayload?: FormatterPayload },
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('workflow_events').insert({
    workflow: row.workflow,
    event_type: row.event_type,
    trigger_id: row.trigger_id ?? null,
    company_id: row.company_id,
    payload: row.payload ?? {},
    status: row.status ?? 'pending',
  })

  if (!error && options?.dispatchKind) {
    // Fire-and-forget — never block the caller.
    void dispatchTelegramForEvent(options.dispatchKind, {
      ...(row.payload ?? {}),
      ...(options.dispatchPayload ?? {}),
      trigger_id: row.trigger_id,
      company_id: row.company_id,
    })
  }

  return { error }
}
