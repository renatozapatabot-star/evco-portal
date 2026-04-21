/**
 * Mensajería · public constants + invariants.
 *
 * Invariant: external-facing sender name is ALWAYS "Renato Zapata & Company".
 * Individual operator names are never exposed to clients. See CLAUDE.md rule
 * "Expose internal user names to clients — always use 'Renato Zapata & Company'".
 */

export const SENDER_PUBLIC_NAME = 'Renato Zapata & Company'

/** 30-second undo-send window. Message hidden from client view when undone = true. */
export const UNDO_WINDOW_MS = 30_000

/** 25MB max per attachment. Also enforced in DB CHECK constraint. */
export const MAX_ATTACHMENT_BYTES = 26_214_400

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/xml',
  'text/xml',
] as const

/** Internal-facing roles — see every thread regardless of company_id. */
export const INTERNAL_ROLES = ['operator', 'admin', 'broker'] as const

/** Owner tier — can see escalated threads pinned at top, can approve client replies. */
export const OWNER_ROLES = ['admin', 'broker'] as const

export type InternalRole = (typeof INTERNAL_ROLES)[number]
export type OwnerRole = (typeof OWNER_ROLES)[number]

export function isInternalRole(role: string): role is InternalRole {
  return (INTERNAL_ROLES as readonly string[]).includes(role)
}

export function isOwnerRole(role: string): role is OwnerRole {
  return (OWNER_ROLES as readonly string[]).includes(role)
}

/** Phase 1: client surface is off until Week 3 pilot. */
export function isClientSurfaceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MENSAJERIA_CLIENT === 'true'
}

/** Global kill switch — Mensajería off entirely if this flag is missing/false. */
export function isMensajeriaEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MENSAJERIA_ENABLED !== 'false'
}
