import { redirect } from 'next/navigation'

/**
 * Tráfico detail — new implementation in progress (Block 1 Commit B).
 *
 * Until the 70-event state machine UI ships, this route forwards every
 * request to the legacy page so operators never lose access to the
 * trafico detail view. `?legacy=1` is accepted for explicit pinning.
 *
 * The full recon-driven design (5 tabs, HeroStrip, RightRail, BelowFold,
 * Cronología timeline, context-aware Acciones Rápidas) lands in Commit B.
 * Shared primitives and migrations are already in place — see
 * `docs/recon/V2_GLOBALPC_RECON.md` and `src/lib/events-catalog.ts`.
 */
export default async function TraficoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ legacy?: string }>
}) {
  const { id } = await params
  redirect(`/traficos/${id}/legacy`)
}
