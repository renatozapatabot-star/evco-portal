/**
 * Sanitize user input for use in Supabase PostgREST filter strings.
 * Strips characters that could break out of .or() / .ilike() clauses.
 * Use this EVERYWHERE user input goes into a Supabase filter string.
 */
export function sanitizeFilter(input: string): string {
  // Remove PostgREST operator characters that could inject additional filters
  return input.replace(/[,().*\\%]/g, '').trim()
}

/**
 * Sanitize for ILIKE patterns — allows the input text but escapes
 * wildcards so user can't inject %.
 */
export function sanitizeIlike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&').replace(/[,()]/g, '').trim()
}

/**
 * Validate that a string matches expected column name format.
 * Prevents injection via orderBy, gteField, notNullField params.
 */
export function isValidColumn(col: string, allowed: readonly string[]): boolean {
  return allowed.includes(col)
}
