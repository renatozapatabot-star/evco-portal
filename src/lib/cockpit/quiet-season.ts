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

  /** Success rate over the last 90 days — (cruzados / total with fecha_llegada)
   *  as a whole-number percentage. Typically 95+ for a disciplined broker.
   *  Null when the window has no data (pre-first-shipment tenants). */
  successRatePct?: number | null

  /** Average clearance time in days (fecha_cruce minus fecha_llegada) over
   *  the last 90 days. Typically 1–3 days for EVCO-scale tenants. Null when
   *  no crossings have been recorded in the window. */
  avgClearanceDays?: number | null

  /** ISO date string of the last cruzado tráfico (most recent). Null if
   *  the client has no history at all. */
  lastCruceIso: string | null

  /** Count of tráficos cruzado in the current calendar month. */
  crucesThisMonth: number

  /** T-MEC savings year-to-date in USD. 0 or null → T-MEC isn't surfaced.
   *  Used as a fallback 4th-tile value when velocidad is unavailable. */
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

// Compact relative-time variant for narrow KPI tile values.
// "hoy" / "ayer" / "hace Nd" stay short enough to fit the mobile
// 2-column layout without triggering the whitespace-nowrap ellipsis.
function daysAgoShort(iso: string): string {
  const n = daysAgo(iso)
  if (n === 0) return 'hoy'
  if (n === 1) return 'ayer'
  if (n < 30) return `hace ${n}d`
  const months = Math.floor(n / 30)
  if (months === 1) return 'hace 1 mes'
  return `hace ${months} meses`
}

function currentMonthLabel(): string {
  return new Date().toLocaleDateString(LOCALE, { timeZone: TZ, month: 'long' })
}

// USD formatter — whole dollars, JetBrains Mono handled by KPITile number slot.
function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString(LOCALE)} USD`
}

// Compact USD for tile values — $12.5K / $2.1M. Short enough to render
// at the numeric tile's big-display size without truncation.
function formatUsdCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return `$${Math.round(n)}`
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

  // Quiet-season mode — always emit 4 tiles for a balanced 2x2 grid
  // (Renato 2026-04-20). Copy is tuned for the ~170px-wide tile that
  // lands on iPhone 393 viewports: labels fit one line, values stay
  // short enough to render without ellipsis, sublabels cap ~28 chars.
  // 2026-04-20 screenshot audit flagged "Último cruce exitoso" wrapping
  // to 3 lines + "hac…" / "7.9" truncation — this pass fixes both.
  const tiles: CockpitHeroKPI[] = []

  // Tile 1 — Tasa de éxito (replaces "Días sin incidencias").
  if (input.successRatePct != null && input.successRatePct >= 0) {
    const pct = Math.max(0, Math.min(100, Math.round(input.successRatePct)))
    tiles.push({
      key: 'tasa-exito',
      label: 'Tasa de éxito',
      value: `${pct}%`,
      sublabel: 'últimos 90 días',
      tone: 'teal' as QuietTone as CockpitHeroKPI['tone'],
      ariaLabel: `Tasa de éxito ${pct} por ciento`,
    })
  } else {
    tiles.push({
      key: 'operacion-estable',
      label: 'Operación estable',
      value: 'Al día',
      sublabel: 'cruces al corriente',
      tone: 'teal' as QuietTone as CockpitHeroKPI['tone'],
    })
  }

  // Tile 2 — Último cruce. Shorter label ("Último cruce" vs "Último
  // cruce exitoso") fits one line in the 170px tile. Value "hace Nd"
  // saves horizontal space; sublabel carries the full date.
  if (input.lastCruceIso) {
    tiles.push({
      key: 'ultimo-cruce',
      label: 'Último cruce',
      value: daysAgoShort(input.lastCruceIso),
      sublabel: formatDateAbs(input.lastCruceIso),
      tone: 'slate' as QuietTone as CockpitHeroKPI['tone'],
    })
  } else {
    tiles.push({
      key: 'ultimo-cruce',
      label: 'Último cruce',
      value: 'Sin cruces',
      tone: 'slate' as QuietTone as CockpitHeroKPI['tone'],
    })
  }

  // Tile 3 — Volumen del mes. "Cruces en abril" reads cleanly and
  // fits on one line; "Cruces completados en abril" wrapped to 2.
  tiles.push({
    key: 'volumen-mes',
    label: `Cruces en ${currentMonthLabel()}`,
    value: input.crucesThisMonth,
    tone: 'slate' as QuietTone as CockpitHeroKPI['tone'],
  })

  // Tile 4 — cascade: velocidad → tmec → fallback. Velocidad renders
  // as pure number so KPITile treats it as numeric (tight mono display)
  // with "días" in the sublabel. Previously "7.9 d" was classified as
  // prose and got truncated on narrow mobile columns.
  if (input.avgClearanceDays != null && input.avgClearanceDays > 0) {
    const days = Math.round(input.avgClearanceDays * 10) / 10
    tiles.push({
      key: 'velocidad-cruce',
      label: 'Velocidad promedio',
      value: days,
      sublabel: 'días · llegada → cruce',
      tone: 'teal' as QuietTone as CockpitHeroKPI['tone'],
    })
  } else if (input.tmecYtdUsd != null && input.tmecYtdUsd > 0) {
    tiles.push({
      key: 'tmec-ytd',
      label: 'Ahorro T-MEC',
      value: formatUsdCompact(input.tmecYtdUsd),
      sublabel: 'acumulado este año',
      tone: 'teal' as QuietTone as CockpitHeroKPI['tone'],
    })
  } else {
    tiles.push({
      key: 'historial',
      label: 'Historial',
      value: 'Confiable',
      sublabel: 'cruces registrados',
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
