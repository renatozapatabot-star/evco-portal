import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Zap } from 'lucide-react'
import { requireOperator } from '@/lib/route-guards'
import { listActionsAdmin, type AgentActionRow } from '@/lib/aguila/actions'
import { ActionsQueueClient } from './ActionsQueueClient'

/**
 * /operador/actions — Operator Actions Queue.
 *
 * Surfaces every committed (but not-yet-executed) agent action so an
 * operator / admin / broker can one-click Execute the downstream
 * side-effect. Full audit trail: historical `cancelled` and
 * `executed` rows are visible via the status filter so the queue is
 * also the append-only log of agent authority use.
 *
 * Tenant contract: this surface is internal-only (requireOperator —
 * operator/admin/broker) and intentionally bypasses per-tenant filters
 * so a broker sees every client's agent activity. Same pattern as
 * mensajeria `isInternalRole`. Clients never reach this route.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

type CompanyRef = { company_id: string; name: string }

async function loadCompanies(sb: SupabaseClient): Promise<CompanyRef[]> {
  const { data } = await sb
    .from('companies')
    .select('company_id, name')
    .order('name', { ascending: true })
    .limit(500)
  return ((data ?? []) as CompanyRef[]).filter((c) => c.company_id && c.name)
}

export default async function OperadorActionsPage() {
  const session = await requireOperator()

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Default view: the working queue — committed rows (awaiting execute)
  // plus any execute_failed rows that need attention. Cancelled and
  // executed rows are reachable via the status filter as audit history.
  const [queue, history, companies] = await Promise.all([
    listActionsAdmin(sb, {
      statuses: ['committed', 'execute_failed'],
      limit: 200,
    }),
    listActionsAdmin(sb, {
      statuses: ['executed', 'cancelled'],
      limit: 100,
    }),
    loadCompanies(sb),
  ])

  const initial: AgentActionRow[] = [...queue, ...history]

  return (
    <ActionsQueueClient
      initial={initial}
      companies={companies}
      sessionRole={session.role}
      heroIcon={<Zap size={20} aria-hidden />}
    />
  )
}
