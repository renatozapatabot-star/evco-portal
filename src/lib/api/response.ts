/**
 * API response helpers — the canonical { data, error } contract.
 *
 * Why this exists:
 *   Every /api/* route in this repo returns the same shape:
 *     { data: T | null, error: { code, message } | null }
 *
 *   Documented in `.claude/rules/cruz-api.md`. Every route re-implements
 *   this by hand-rolling `NextResponse.json({ data, error: {...} },
 *   { status: N })`. This module collapses that boilerplate into:
 *
 *     return ok(data)                      // 200 happy path
 *     return notFound('lead_not_found')    // 404
 *     return validationError('bad_json')   // 400
 *     return conflict('already_exists')    // 409
 *     return internalError('db_failed')    // 500
 *
 *   Grok + future builders import these helpers instead of
 *   reinventing the shape on every route.
 *
 * Design choices:
 *   - Error `code` is uppercase SNAKE_CASE so client-side switches
 *     have a stable enum to match on.
 *   - Error `message` is free-text lowercase_snake by convention;
 *     clients show a translated label from a dictionary, not the
 *     raw message (avoids i18n coupling).
 *   - Helpers return `NextResponse` directly so a handler can
 *     `return ok(data)` without wrapping.
 *
 * What this module does NOT do:
 *   - Doesn't handle Zod validation — that's the handler's job
 *     (too route-specific to generalize here).
 *   - Doesn't enforce the `data` type — callers pass `T`, and the
 *     type-system carries it through `ok<T>()`.
 *
 * Response-code reference:
 *   - NOT_FOUND         → 404
 *   - VALIDATION_ERROR  → 400
 *   - UNAUTHORIZED      → 401 (use session-guards.ts helpers instead)
 *   - FORBIDDEN         → 403
 *   - RATE_LIMITED      → 429
 *   - CONFLICT          → 409
 *   - INTERNAL_ERROR    → 500
 */

import { NextResponse } from 'next/server'

export type ApiErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'

export interface ApiError {
  code: ApiErrorCode
  message: string
}

export interface ApiOk<T> {
  data: T
  error: null
}

export interface ApiFail {
  data: null
  error: ApiError
}

export type ApiResponse<T> = ApiOk<T> | ApiFail

/** 200/201 happy path. Pass { status: 201 } for created resources. */
export function ok<T>(
  data: T,
  init?: { status?: 200 | 201; headers?: Record<string, string> },
): NextResponse {
  return NextResponse.json(
    { data, error: null } satisfies ApiOk<T>,
    { status: init?.status ?? 200, headers: init?.headers },
  )
}

/** 400 VALIDATION_ERROR. Use for bad input, malformed JSON, etc. */
export function validationError(message: string): NextResponse {
  return NextResponse.json(
    { data: null, error: { code: 'VALIDATION_ERROR' as const, message } } satisfies ApiFail,
    { status: 400 },
  )
}

/** 404 NOT_FOUND. Use for "resource doesn't exist for this caller"
 *  (which includes cross-tenant misses per tenant-isolation.md). */
export function notFound(message = 'not_found'): NextResponse {
  return NextResponse.json(
    { data: null, error: { code: 'NOT_FOUND' as const, message } } satisfies ApiFail,
    { status: 404 },
  )
}

/** 409 CONFLICT. Use for duplicate-key, already-done, or state conflicts. */
export function conflict(message: string): NextResponse {
  return NextResponse.json(
    { data: null, error: { code: 'CONFLICT' as const, message } } satisfies ApiFail,
    { status: 409 },
  )
}

/** 429 RATE_LIMITED. Always set Retry-After header when known. */
export function rateLimited(
  message = 'rate_limited',
  retryAfterSeconds?: number,
): NextResponse {
  const headers: Record<string, string> = {}
  if (typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0) {
    headers['Retry-After'] = String(Math.ceil(retryAfterSeconds))
  }
  return NextResponse.json(
    { data: null, error: { code: 'RATE_LIMITED' as const, message } } satisfies ApiFail,
    { status: 429, headers },
  )
}

/** 500 INTERNAL_ERROR. Use for caught exceptions + unexpected DB failures. */
export function internalError(message = 'internal_error'): NextResponse {
  return NextResponse.json(
    { data: null, error: { code: 'INTERNAL_ERROR' as const, message } } satisfies ApiFail,
    { status: 500 },
  )
}

/** Generic escape hatch for cases where the status-code + code are
 *  unusual — e.g. a specific 403 that isn't the default FORBIDDEN.
 *  Prefer a named helper above when one fits. */
export function fail(
  status: number,
  code: ApiErrorCode,
  message: string,
): NextResponse {
  return NextResponse.json(
    { data: null, error: { code, message } } satisfies ApiFail,
    { status },
  )
}
