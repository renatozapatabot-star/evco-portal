/**
 * Routine auth — every /api/routines/* endpoint gates on this.
 *
 * Anthropic Claude Routines call these endpoints from their cloud
 * infrastructure. We don't want the public internet hitting them, so
 * they ship a shared secret in `x-routine-secret` and we verify against
 * `ROUTINE_SECRET` env var.
 *
 * Rotate the secret by rotating the env var in both Vercel and the
 * routine config in claude.ai/code/routines. No re-deploy needed on
 * the Anthropic side — they read env on each run.
 */

import { NextResponse } from 'next/server'

export interface RoutineAuthOk {
  ok: true
  routineName: string
}
export interface RoutineAuthFail {
  ok: false
  response: NextResponse
}

/**
 * Validate the incoming routine call. Returns either `{ ok: true }` or a
 * ready-to-return NextResponse with the right 401/403 payload.
 *
 * Usage:
 *   const auth = verifyRoutineRequest(request, 'morning-briefing')
 *   if (!auth.ok) return auth.response
 */
export function verifyRoutineRequest(
  request: Request,
  routineName: string,
): RoutineAuthOk | RoutineAuthFail {
  const secret = process.env.ROUTINE_SECRET
  if (!secret) {
    return {
      ok: false,
      response: NextResponse.json(
        { data: null, error: { code: 'INTERNAL_ERROR', message: 'ROUTINE_SECRET not configured' } },
        { status: 500 },
      ),
    }
  }
  const provided = request.headers.get('x-routine-secret')
  if (!provided || provided !== secret) {
    return {
      ok: false,
      response: NextResponse.json(
        { data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid routine secret' } },
        { status: 401 },
      ),
    }
  }
  return { ok: true, routineName }
}

/**
 * Standard JSON envelope for routine endpoint responses. Matches the
 * rest of the app's API shape per `.claude/rules/cruz-api.md`.
 */
export function routineOk<T>(data: T): NextResponse {
  return NextResponse.json({ data, error: null })
}

export function routineError(code: string, message: string, status = 500): NextResponse {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}
