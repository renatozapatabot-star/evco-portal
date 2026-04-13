import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * /api/debug/whoami — diagnostic. Reports session decode + a one-shot
 * probe per cockpit-critical table so we can see exactly what's missing
 * for the logged-in user's scope.
 *
 * Returns: { ok, session, probes }. Safe to expose: no PII.
 */
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token).catch(() => null)
  const userRole = cookieStore.get('user_role')?.value ?? null
  const companyIdCookie = cookieStore.get('company_id')?.value ?? null

  const sb = createServerClient()
  const probes: Record<string, { ok: boolean; count?: number | null; error?: string }> = {}

  async function probe(label: string, fn: () => PromiseLike<{ data: unknown; error: unknown; count?: number | null }>) {
    try {
      const r = await Promise.race([
        fn(),
        new Promise<{ error: string }>((resolve) => setTimeout(() => resolve({ error: 'timeout' }), 2500)),
      ])
      if ((r as { error?: unknown }).error) {
        probes[label] = { ok: false, error: String((r as { error: unknown }).error) }
      } else {
        probes[label] = { ok: true, count: (r as { count?: number | null }).count ?? null }
      }
    } catch (e) {
      probes[label] = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  await Promise.all([
    probe('audit_log',         () => sb.from('audit_log').select('id', { count: 'exact', head: true })),
    probe('mensajeria_messages', () => sb.from('mensajeria_messages').select('id', { count: 'exact', head: true })),
    probe('mensajeria_threads',  () => sb.from('mensajeria_threads').select('id', { count: 'exact', head: true })),
    probe('traficos_for_company', () => session ? sb.from('traficos').select('trafico', { count: 'exact', head: true }).eq('company_id', session.companyId) : Promise.resolve({ data: null, error: 'no-session', count: null })),
    probe('entradas_for_company', () => session ? sb.from('entradas').select('id', { count: 'exact', head: true }).eq('company_id', session.companyId) : Promise.resolve({ data: null, error: 'no-session', count: null })),
    probe('expediente_documentos', () => sb.from('expediente_documentos').select('id', { count: 'exact', head: true })),
    probe('globalpc_productos', () => sb.from('globalpc_productos').select('id', { count: 'exact', head: true })),
    probe('companies_for_company', () => session ? sb.from('companies').select('company_id', { count: 'exact', head: true }).eq('company_id', session.companyId) : Promise.resolve({ data: null, error: 'no-session', count: null })),
  ])

  return NextResponse.json({
    ok: true,
    cookies: {
      user_role: userRole,
      company_id: companyIdCookie,
      has_portal_session: Boolean(token),
    },
    session: session
      ? { role: session.role, companyId: session.companyId }
      : null,
    probes,
    timestamp: new Date().toISOString(),
  })
}
