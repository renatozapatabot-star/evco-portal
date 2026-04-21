/**
 * sanitizeError — scrubs DB / file-system / internal details from error
 * messages before they reach the user.
 *
 * Security audit found ~80 API routes returning raw `error.message` to
 * clients, which can leak Supabase table names, RLS policy names, column
 * names, file paths, and SQL error codes. That's a reconnaissance vector.
 *
 * Usage:
 *   import { sanitizeError } from '@/lib/api/sanitize-error'
 *   ...
 *   } catch (err) {
 *     return NextResponse.json({ data: null, error: sanitizeError(err) }, { status: 500 })
 *   }
 *
 * In dev, returns the full error for debuggability. In prod, returns a
 * generic message for any error whose text matches known-leak patterns.
 */

export interface SafeError {
  code: string
  message: string
}

const LEAK_PATTERNS = [
  /\bcolumn\b/i,
  /\btable\b/i,
  /\brelation\b/i,
  /\brow-level security\b/i,
  /\bpolicy\b/i,
  /\bsupabase\b/i,
  /\bpostgres\b/i,
  /\bpg_/i,
  /\b\/(home|var|etc|tmp|Users)\//, // filesystem paths
  /\bSQLSTATE\b/i,
  /\bCONSTRAINT\b/i,
  /\bTRIGGER\b/i,
  /\bFUNCTION\b/i,
  /\bSCHEMA\b/i,
  /\bauth\./i,
]

const GENERIC_MESSAGE = 'Error interno. Intenta de nuevo en unos momentos.'
const MAX_MESSAGE_LEN = 200

/**
 * Convert any thrown value into a safe `{ code, message }` response shape.
 * In development returns the raw message for debuggability. In production
 * scrubs anything matching LEAK_PATTERNS to GENERIC_MESSAGE.
 */
export function sanitizeError(err: unknown, code = 'INTERNAL_ERROR'): SafeError {
  const raw = err instanceof Error ? err.message : String(err)

  if (process.env.NODE_ENV !== 'production') {
    return { code, message: raw.slice(0, MAX_MESSAGE_LEN) }
  }

  for (const pattern of LEAK_PATTERNS) {
    if (pattern.test(raw)) {
      return { code, message: GENERIC_MESSAGE }
    }
  }

  // Even safe-looking messages get truncated — no novel-length payloads.
  return { code, message: raw.slice(0, MAX_MESSAGE_LEN) || GENERIC_MESSAGE }
}

/**
 * For routes that want to expose validation errors (Zod, user input) but
 * still scrub internal SQL/FS detail if those slip in. Use for 400-class
 * responses.
 */
export function sanitizeValidation(err: unknown): SafeError {
  return sanitizeError(err, 'VALIDATION_ERROR')
}
