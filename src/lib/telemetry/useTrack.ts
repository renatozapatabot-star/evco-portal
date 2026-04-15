'use client'

import { useCallback } from 'react'

/**
 * V1 Polish Pack · Block 0 — client-side telemetry hook.
 * Fire-and-forget POST to /api/telemetry. Keep this cheap: never await
 * in render paths, never throw. The endpoint composes the user_id
 * (companyId:role) from the authenticated session, so callers don't
 * need to pass identity.
 */
export type TrackPayload = {
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
}

// 15 canonical event types for the Polish Pack. Keep this list in sync
// with docs/V1_POLISH_PACK_AUDIT.md — blocks wire a subset each.
export type TelemetryEvent =
  | 'page_view'
  | 'trafico_status_changed'
  | 'trafico_note_added'
  | 'mention_created'
  | 'bulk_action_executed'
  | 'saved_view_used'
  | 'doc_uploaded'
  | 'doc_autoclassified'
  | 'doc_type_corrected'
  | 'solicitation_sent'
  | 'notification_clicked'
  | 'comment_added'
  | 'briefing_email_opened'
  | 'shadow_disagreement_viewed'
  | 'checklist_item_viewed'

export function track(event: TelemetryEvent, payload: TrackPayload = {}): void {
  if (typeof window === 'undefined') return
  // Best-effort. Swallowing is fine — we must never break the UI over telemetry.
  // This is NOT a silent script failure: the server endpoint still logs to Supabase
  // for every successful request, which is the ground truth.
  void fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event, ...payload }),
    keepalive: true,
  }).catch((err: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[telemetry] track failed', err)
    }
  })
}

/** React hook form. Stable identity so it's safe in deps arrays. */
export function useTrack() {
  return useCallback((event: TelemetryEvent, payload: TrackPayload = {}) => {
    track(event, payload)
  }, [])
}
