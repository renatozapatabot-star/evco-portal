/**
 * Request-body parsing helpers — agents get a consistent
 * fail-loud-but-return-a-response experience instead of hand-rolling
 * try/catch + Zod.safeParse at every POST route.
 *
 * Why this exists:
 *   Every API route that accepts JSON ends up writing the same ~15
 *   lines:
 *
 *     let body: unknown
 *     try { body = await req.json() } catch { return validationError('bad_json') }
 *     const parsed = Schema.safeParse(body)
 *     if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? 'invalid')
 *     // ...use parsed.data
 *
 *   Three drift points: the error message differs per route, the
 *   json-parse catch sometimes swallows the real error, and agents
 *   occasionally forget one of the two guards entirely.
 *
 *   `parseRequestBody(req, schema)` collapses both into one call that
 *   returns either `{ data }` (caller uses it directly) or `{ error }`
 *   (caller returns it — it's a ready-made NextResponse).
 *
 * Design:
 *   - Schema-first: pass any Zod schema. Type-inferred .data.
 *   - Always returns; never throws. Follows the "loud but recoverable"
 *     pattern from handbook §39.9 at the API layer.
 *   - The returned `error` is a NextResponse already shaped as
 *     ApiFail — `return error` is valid from a handler.
 *   - When there's a schema error, the first issue's message is
 *     forwarded so agents don't have to unpack the ZodError.
 *
 * Usage:
 *   const Schema = z.object({ clave: z.string().min(1) })
 *   const parsed = await parseRequestBody(req, Schema)
 *   if (parsed.error) return parsed.error   // NextResponse 400
 *   const { clave } = parsed.data           // fully typed
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { z } from 'zod'
import { validationError } from '@/lib/api/response'

export interface ParseResultSuccess<T> {
  data: T
  error: null
}

export interface ParseResultFailure {
  data: null
  /** Ready-to-return NextResponse (400 VALIDATION_ERROR). */
  error: NextResponse
  /** Machine-readable reason — 'bad_json' or the Zod issue path. */
  reason: 'bad_json' | 'schema_mismatch'
  /** Raw message (for logging, not for client display). */
  message: string
}

export type ParseResult<T> = ParseResultSuccess<T> | ParseResultFailure

/**
 * Parse + validate a JSON request body against a Zod schema. Never
 * throws. Returns a NextResponse on failure that the caller can
 * return directly.
 *
 * @param req    The NextRequest (or any request with a `.json()` method).
 * @param schema A Zod schema describing the expected body shape.
 * @param opts   Optional overrides:
 *                 - prefix: string prepended to the error message
 *                   (e.g. `'approve_draft'` → `'approve_draft: bad_json'`).
 */
export async function parseRequestBody<T extends z.ZodTypeAny>(
  req: Pick<NextRequest, 'json'>,
  schema: T,
  opts: { prefix?: string } = {},
): Promise<ParseResult<z.infer<T>>> {
  const prefix = opts.prefix ? `${opts.prefix}: ` : ''

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    const msg = `${prefix}bad_json`
    return {
      data: null,
      error: validationError(msg),
      reason: 'bad_json',
      message: msg,
    }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue?.path?.length ? issue.path.join('.') : '(body)'
    const label = issue?.message ?? 'invalid'
    const msg = `${prefix}${path}: ${label}`
    return {
      data: null,
      error: validationError(msg),
      reason: 'schema_mismatch',
      message: msg,
    }
  }

  return { data: parsed.data as z.infer<T>, error: null }
}

/**
 * Parse a JSON string safely. Returns `{ data, error }` without
 * throwing. Use when you have a raw string (e.g. a column stored as
 * JSON text) rather than a Request.
 */
export function safeJsonParse<T = unknown>(
  input: string | null | undefined,
  opts: { fallback?: T } = {},
): { data: T; error: null } | { data: T; error: string } {
  if (input == null || input === '') {
    if ('fallback' in opts && opts.fallback !== undefined) {
      return { data: opts.fallback, error: null }
    }
    return { data: (null as unknown) as T, error: 'empty_input' }
  }

  try {
    return { data: JSON.parse(input) as T, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'parse_failed'
    const fallback = (opts.fallback ?? ((null as unknown) as T)) as T
    return { data: fallback, error: msg }
  }
}

/**
 * Validate a value against a Zod schema WITHOUT touching a request.
 * Use when the value comes from a Supabase row's jsonb column, a
 * query string, etc. Returns `{ data, error }`.
 */
export function validateWithSchema<T extends z.ZodTypeAny>(
  value: unknown,
  schema: T,
): { data: z.infer<T>; error: null } | { data: null; error: string } {
  const parsed = schema.safeParse(value)
  if (parsed.success) return { data: parsed.data as z.infer<T>, error: null }
  const issue = parsed.error.issues[0]
  const path = issue?.path?.length ? issue.path.join('.') : '(root)'
  return { data: null, error: `${path}: ${issue?.message ?? 'invalid'}` }
}
