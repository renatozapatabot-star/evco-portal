import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Canonical "último cruce" query — single source of truth for the
 * most-recent border crossing a client has completed.
 *
 * Three cockpit surfaces (/inicio hero, /inicio nav-card microstatus,
 * command-center WorkflowCard topbar) previously diverged on this
 * number because each one ran its own query with subtly different
 * filters ({estatus:'Cruzado'} vs `includes('cruz')` vs no-filter).
 * That produced three different "hace N días" readings on the same
 * page. This helper collapses them.
 *
 * Estatus contract: treats Cruzado, E1, and Entregado all as terminal
 * crossed states. The semantics match `estatus-translator.ts` and
 * reflect the three historical values that end up with a non-null
 * fecha_cruce in production data.
 */

const CROSSED_ESTATUS = ['Cruzado', 'E1', 'Entregado']

export interface LatestCrossing {
  trafico: string
  fecha_cruce: string
  /** 0 verde · 1 amarillo · 2 rojo · null unknown. Optional so older
   * call sites that don't need it can ignore it. Added M8 to let the
   * /inicio subtitle show "cruzó verde hace 3 días" — a meaningful
   * micro-delight vs the plain "cruzó hace 3 días". */
  semaforo?: number | null
}

export async function getLatestCrossing(
  supabase: SupabaseClient,
  companyId: string,
): Promise<LatestCrossing | null> {
  const { data } = await supabase
    .from('traficos')
    .select('trafico, fecha_cruce, semaforo')
    .eq('company_id', companyId)
    .in('estatus', CROSSED_ESTATUS)
    .not('fecha_cruce', 'is', null)
    .order('fecha_cruce', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const row = data as { trafico?: string | null; fecha_cruce?: string | null; semaforo?: number | null } | null
  if (!row || !row.trafico || !row.fecha_cruce) return null
  return {
    trafico: row.trafico,
    fecha_cruce: row.fecha_cruce,
    semaforo: typeof row.semaforo === 'number' ? row.semaforo : null,
  }
}

/**
 * Pure fn mirror for clients that already have a pre-fetched list of
 * tráficos in memory (command-center hook). Applies the same estatus
 * + fecha_cruce contract locally — no DB round trip.
 */
export function pickLatestCrossing<T extends { trafico?: string | null; fecha_cruce?: string | null; estatus?: string | null }>(
  rows: T[],
): LatestCrossing | null {
  const eligible = rows.filter(
    (r) => !!r.fecha_cruce && !!r.trafico && CROSSED_ESTATUS.includes(r.estatus ?? ''),
  )
  if (eligible.length === 0) return null
  eligible.sort((a, b) => (b.fecha_cruce || '').localeCompare(a.fecha_cruce || ''))
  const top = eligible[0]
  return { trafico: top.trafico!, fecha_cruce: top.fecha_cruce! }
}
