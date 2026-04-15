/**
 * Mensajería · OneSignal push wrapper.
 *
 * Non-fatal: a push failure never breaks the caller. Infra errors are
 * surfaced via Telegram (outside the mensajeria/ directory — sent by the
 * caller, not from here) so CLAUDE.md's "no sendTelegram inside mensajeria/"
 * boundary holds.
 *
 * Gated by MENSAJERIA_PUSH_ENABLED — when 'false' or missing, all sends
 * no-op and return { sent: 0, skipped: 'disabled' }.
 */

import { createClient } from '@supabase/supabase-js'

const ONESIGNAL_API = 'https://onesignal.com/api/v1/notifications'

export interface SendPushInput {
  /** user_keys — matches mensajeria_push_subscriptions.user_key. */
  userKeys: string[]
  title: string
  body: string
  /** Deep link URL (absolute). Clicking the push opens this. */
  url: string
}

export interface SendPushResult {
  sent: number
  skipped?: 'disabled' | 'no_subscribers' | 'missing_credentials'
  error?: string
}

function isPushEnabled(): boolean {
  return process.env.MENSAJERIA_PUSH_ENABLED === 'true'
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function resolvePlayerIds(userKeys: string[]): Promise<string[]> {
  if (userKeys.length === 0) return []
  const supabase = serviceClient()
  const { data } = await supabase
    .from('mensajeria_push_subscriptions')
    .select('onesignal_player_id')
    .in('user_key', userKeys)
    .is('revoked_at', null)
  return ((data ?? []) as { onesignal_player_id: string }[])
    .map((r) => r.onesignal_player_id)
    .filter(Boolean)
}

export async function sendPush(input: SendPushInput): Promise<SendPushResult> {
  if (!isPushEnabled()) {
    return { sent: 0, skipped: 'disabled' }
  }

  const appId = process.env.ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_REST_API_KEY
  if (!appId || !apiKey) {
    return { sent: 0, skipped: 'missing_credentials' }
  }

  const playerIds = await resolvePlayerIds(input.userKeys)
  if (playerIds.length === 0) {
    return { sent: 0, skipped: 'no_subscribers' }
  }

  try {
    const response = await fetch(ONESIGNAL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_player_ids: playerIds,
        headings: { en: input.title, es: input.title },
        contents: { en: input.body, es: input.body },
        url: input.url,
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return { sent: 0, error: `OneSignal ${response.status}: ${text.slice(0, 200)}` }
    }
    return { sent: playerIds.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { sent: 0, error: msg }
  }
}

export async function registerPlayerId(input: {
  userKey: string
  playerId: string
  platform: 'web' | 'ios' | 'android'
  userAgent?: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = serviceClient()
  const { error } = await supabase
    .from('mensajeria_push_subscriptions')
    .upsert(
      {
        user_key: input.userKey,
        onesignal_player_id: input.playerId,
        platform: input.platform,
        user_agent: input.userAgent ?? null,
        revoked_at: null,
      },
      { onConflict: 'user_key,onesignal_player_id' },
    )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function revokePlayerId(userKey: string, playerId: string): Promise<void> {
  const supabase = serviceClient()
  await supabase
    .from('mensajeria_push_subscriptions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_key', userKey)
    .eq('onesignal_player_id', playerId)
}
