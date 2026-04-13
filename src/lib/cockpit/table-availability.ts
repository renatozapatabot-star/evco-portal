/**
 * AGUILA v9 — memoized schema probes.
 *
 * Some tables (audit_log, mensajeria_*) may or may not exist in production
 * depending on migration-history state. Instead of crashing a cockpit SSR
 * each request, probe once per process, cache the result, and let feature
 * code branch on it. When migrations are reconciled, next cold start flips
 * the flag automatically.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const cache = new Map<string, boolean>()
const inflight = new Map<string, Promise<boolean>>()

async function probeOnce(sb: SupabaseClient, table: string): Promise<boolean> {
  if (cache.has(table)) return cache.get(table)!
  const existing = inflight.get(table)
  if (existing) return existing

  const p = (async () => {
    try {
      const { error } = await sb.from(table).select('*', { count: 'exact', head: true }).limit(1)
      const present = !error
      cache.set(table, present)
      return present
    } catch {
      cache.set(table, false)
      return false
    } finally {
      inflight.delete(table)
    }
  })()
  inflight.set(table, p)
  return p
}

export const auditLogAvailable   = (sb: SupabaseClient) => probeOnce(sb, 'audit_log')
export const mensajeriaAvailable = (sb: SupabaseClient) => probeOnce(sb, 'mensajeria_messages')
export const mensajeriaThreadsAvailable = (sb: SupabaseClient) => probeOnce(sb, 'mensajeria_threads')
