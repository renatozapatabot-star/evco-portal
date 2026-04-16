/**
 * Quiet-season cockpit builder.
 *
 * EVCO has seasonal lulls where zero tráficos are in transit. Before this
 * mode existed the cockpit hero just showed "0 / 0 / 0 / 0" and the client
 * portal felt empty on Ursula's Monday login.
 *
 * When activeCount === 0 we replace the four standard KPIs with a layout
 * that celebrates stability ("days without incidents", "last successful
 * crossing", "completed this month", optional T-MEC savings YTD) and
 * overlays a single reassuring summary line.
 *
 * This file is pure — all DB reads happen server-side in /inicio/page.tsx
 * which passes the primitive inputs in. Easy to unit-test.
 */

import type { CockpitHeroKPI } from '@/components/aguila'

// Design-system tones we allow on client-surface tiles (invariant #24 — no
// urgency reds/ambers; quiet-season only uses calm semantics).
type QuietTone = 'teal' | 'slate' | 'silver'

export interface ClientHeroInputs {
  /** Number of active (non-terminal) tráficos for the client right now. */
  activeCount: number

  /** Standard 4-tile hero KPIs to use when activeCount > 0 (not quiet-season). */
  standardTiles: CockpitHeroKPI[]

  /** Days since the last incident (E2/E3 or similar). Capped at some UI max
   *  by the caller. Used only in quiet-season. */
  daysSinceLastIncident: number

  /** ISO date string of the last cruzado tráfico (most recent). Null if
   *  the client has no history at all. */
  lastCruceIso: string | null

  /** Count of tráficos cruzado in the current calendar month. */
  crucesThisMonth: number

  /** T-MEC savings year-to-date in USD. 0 or null → the tile is dropped
   *  and quiet-season renders 3 tiles instead of 4. */
  tmecYtdUsd: number | null

  /** Optional: ISO date string of the last pedimento to power the nav-card
   *  sad-zero swap. Null → no swap, navCounts keep their microStatus as-is. */
  lastPedimentoIso?: string | null

  /** Current count of pedimentos this month — used to decide whether to
   *  apply the sad-zero swap to the Pedimentos nav card. */
  pedimentosMonthCount?: number
}

export interface ClientHeroOutput {
  /** The 3 or 4 tiles to render in the hero. Always a valid array of
   *  CockpitHeroKPI objects — InicioClientShell renders them the same way
   *  regardless of mode. */
  heroKPIs: CockpitHeroKPI[]

  /** The summary line to pass to CockpitInicio. When quiet-season we emit
   *  the reassuring prose; when active the caller's existing summaryLine
   *  is echoed back. `null` means "use whatever the caller had". */
  summaryLine: string | null

  /** If set, the Pedimentos nav card's microStatus should be overridden
   *  with this string (sad-zero replacement). */
  pedimentoMicroStatusOverride: string | null

  /** Whether this build is in quiet-season mode (activeCount === 0). */
  quietSeason: boolean
}

// Locale-consistent formatters — Laredo timezone, es-MX.
const LOCALE = 'es-MX'
const TZ = 'America/Chicago'

function formatDateAbs(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(LOCALE, { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' })
}

function daysAgo(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

function daysAgoLabel(iso: string): string {
  const n = daysAgo(iso)
  if (n === 0) return 'hoy'
  if (n === 1) return 'hace 1 día'
  return `hace ${n} días`
}

function currentMonthLabel(): string {
  return new Date().toLocaleDateString(LOCALE, { timeZone: TZ, month: 'long' })
}

// USD formatter — whole dollars, JetBrains Mono handled by KPITile number slot.
function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString(LOCALE)} USD`
}

/**
 * Build the hero content for the client cockpit. Branches on activeCount
 * and returns either the caller's standard tiles untouched or a freshly
 * composed quiet-season set.
 */
export function buildClientHeroTiles(input: ClientHeroInputs): ClientHeroOutput {
  const quiet = input.activeCount === 0

  if (!quiet) {
    // Standard mode — return caller's tiles unchanged; emit null so the
    // caller keeps its own computed summaryLine + navCounts.
    return {
      heroKPIs: input.standardTiles,
      summaryLine: null,
      pedimentoMicroStatusOverride: null,
      quietSeason: false,
    }
  }

  // Quiet-season mode.
  const tiles: CockpitHeroKPI[] = []

  // Tile 1 — Operación estable. Sublabel gives the start date so
  // "30 días" has a reference point ("desde 17 mar") in small mono
  // under the headline. Matches the Último cruce tile shape: value
  // is the readable headline, sublabel is the absolute anchor.
  const days = Math.max(0, input.daysSinceLastIncident)
  const since = new Date(Date.now() - days * 86_400_000)
  const sinceLabel = !isNaN(since.getTime())
    ? since.toLocaleDateString(LOCALE, { timeZone: TZ, day: 'numeric', month: 'short' })
    : null
  tiles.push({
    key: 'operacion-estable',
    label: 'Días sin incidencias',
    value: days,
    sublabel: sinceLabel ? `desde ${sinceLabel}` : undefined,
    tone: 'teal' as QuietTone as CockpitHeroKPI['tone'],
    ariaLabel: `${days} días sin incidencias`,
  })

  // Tile 2 — Último cruce. Splits relative + absolute into value +
  // sublabel so KPITile can render them on two lines (fix 2026-04-16
  // prod screenshot — the concatenated "hace 36 días · 10 mar 2026"
  // wrapped badly at mobile widths and drifted at desktop).
  if (input.lastCruceIso) {
    tiles.push({
      key: 'ultimo-cruce',
      label: 'Último cruce exitoso',
      value: daysAgoLabel(input.lastCruceIso),
      sublabel: formatDateAbs(input.lastCruceIso),
      tone: 'slate' as QuietTone as CockpitHeroKPI['tone'],
    })
  } else {
    tiles.push({
      key: 'ultimo-cruce',
      label: 'Último cruce exitoso',
      value: 'Sin cruces aún',
      tone: 'slate' as QuietTone as CockpitHeroKPI['tone'],
    })
  }

  // Tile 3 — Volumen del mes
  tiles.push({
    key: 'volumen-mes',
    label: `Cruces completados en ${currentMonthLabel()}`,
    value: input.crucesThisMonth,
    tone: 'slate' as QuietTone as CockpitHeroKPI['tone'],
  })

  // Tile 4 — Ahorro T-MEC YTD (dropped when 0 or null)
  if (input.tmecYtdUsd !== null && input.tmecYtdUsd > 0) {
    tiles.push({
      key: 'tmec-ytd',
      label: 'Ahorrado con T-MEC este año',
      value: formatUsd(input.tmecYtdUsd),
      tone: 'teal' as QuietTone as CockpitHeroKPI['tone'],
    })
  }

  // Nav card sad-zero replacement — only when Pedimentos count for the
  // month is 0 AND we know the last pedimento date.
  let pedimentoMicroStatusOverride: string | null = null
  if (
    input.pedimentosMonthCount === 0
    && input.lastPedimentoIso
  ) {
    pedimentoMicroStatusOverride = `Último pedimento · ${daysAgoLabel(input.lastPedimentoIso)}`
  }

  return {
    heroKPIs: tiles,
    summaryLine: 'Tu operación está al corriente. Todo tu historial en un lugar.',
    pedimentoMicroStatusOverride,
    quietSeason: true,
  }
}
