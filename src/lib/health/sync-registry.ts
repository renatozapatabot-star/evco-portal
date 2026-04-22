/**
 * PORTAL · Sync-type registry — single source of truth for which syncs
 * exist, how often each one is expected to run, and which ones are
 * load-bearing enough to gate a production ship.
 *
 * Consumers:
 *   · `/api/health/data-integrity` — splits the verdict by criticality
 *     so a retired weekly cron never turns the ship-gate red.
 *   · `/admin/sync-health` — labels sync rows and groups them into
 *     critical / non-critical buckets for the dashboard summary.
 *
 * Relationship to `src/lib/cockpit/freshness.ts`:
 *   `freshness.ts` encodes the client-surface "30-minute sync contract"
 *   promise (45/90 min bands, flat). That is the right model for a
 *   single tenant cockpit that only cares about "is my data fresh?".
 *
 *   This registry is the ops-side view: every sync has its own
 *   cadence, so a weekly backfill isn't judged by 45/90-minute
 *   thresholds. Classification here uses cadenceMin × 1.5 (green)
 *   and cadenceMin × 3 (amber). For a 30-minute sync that collapses
 *   back to 45/90, matching the client contract exactly.
 *
 * Adding a sync type:
 *   1. Add `withSyncLog(supabase, { sync_type: '<name>', ... }, run)`
 *      in the script.
 *   2. Append an entry below with its cadence + criticality.
 *   3. If the sync is critical, expect it to appear in the
 *      ship-gate's `critical_syncs_verdict`.
 */

export type SyncHealthBand = 'green' | 'amber' | 'red' | 'unknown'

export interface SyncRegistryEntry {
  /** The literal `sync_type` string written to `sync_log` by the script. */
  syncType: string
  /** Spanish label for the UI (used on /admin/sync-health rows). */
  label: string
  /** Expected cadence in minutes between successful runs. */
  cadenceMin: number
  /** If true, this sync's health contributes to the overall ship-gate verdict. */
  critical: boolean
  /** Optional cron expression, shown in the dashboard tooltip for context. */
  cron?: string
  /** Optional short description for operators investigating a red row. */
  description?: string
}

/**
 * Every entry here must correspond to a `sync_type` value written by a
 * script via `withSyncLog`. Unknown sync_types encountered at runtime
 * are reported with `band: 'unknown'` and never affect the verdict.
 */
export const SYNC_REGISTRY: Record<string, SyncRegistryEntry> = {
  // ── Critical · block ship-gate if stale ──────────────────────────

  globalpc_delta: {
    syncType: 'globalpc_delta',
    label: 'GlobalPC · intradía',
    cadenceMin: 15,
    critical: true,
    cron: '*/15 * * * *',
    description: 'Intraday refresh of globalpc_* tables. Anchors the 30-min sync-contract.',
  },
  globalpc: {
    syncType: 'globalpc',
    label: 'GlobalPC · nocturno',
    cadenceMin: 24 * 60,
    critical: true,
    cron: '0 1 * * *',
    description: 'Nightly authoritative full sync of GlobalPC MySQL into Supabase.',
  },
  email_intake: {
    syncType: 'email_intake',
    label: 'Correo · ingreso',
    cadenceMin: 15,
    critical: true,
    cron: '*/15 * * * *',
    description: 'Gmail poll that creates shadow_classifications and surfaces new shipments.',
  },
  econta_full: {
    syncType: 'econta_full',
    label: 'eConta · intradía + nocturno',
    cadenceMin: 30,
    critical: true,
    cron: '*/30 * * * *',
    description: 'Shared sync_type for both the 30-min intraday pass and the 1 AM nightly full. Classified against the tighter cadence.',
  },
  risk_feed: {
    syncType: 'risk_feed',
    label: 'Riesgo · feed',
    cadenceMin: 60,
    critical: true,
    cron: '0 * * * *',
    description: 'Hourly refresh of the crossing-risk feed for the semáforo predictor.',
  },
  risk_scorer: {
    syncType: 'risk_scorer',
    label: 'Riesgo · scorer',
    cadenceMin: 120,
    critical: true,
    cron: '0 */2 * * *',
    description: 'Scores each active tráfico every 2h and writes predicted semáforo.',
  },

  // ── Non-critical · reported, never flips overall verdict ─────────

  globalpc_facturas_full: {
    syncType: 'globalpc_facturas_full',
    label: 'GlobalPC · facturas (semanal)',
    cadenceMin: 7 * 24 * 60,
    critical: false,
    cron: '0 2 * * 0',
    description: 'Weekly Sunday reconciliation of globalpc_facturas.',
  },
  globalpc_productos_full: {
    syncType: 'globalpc_productos_full',
    label: 'GlobalPC · productos (semanal)',
    cadenceMin: 7 * 24 * 60,
    critical: false,
    description: 'Weekly full catalog rebuild; idempotent.',
  },
  globalpc_eventos_full: {
    syncType: 'globalpc_eventos_full',
    label: 'GlobalPC · eventos (semanal)',
    cadenceMin: 7 * 24 * 60,
    critical: false,
    description: 'Weekly full eventos replay; idempotent.',
  },
  anexo24_reconciler: {
    syncType: 'anexo24_reconciler',
    label: 'Anexo 24 · reconciliador',
    cadenceMin: 15 * 24 * 60,
    critical: false,
    cron: '0 3 1,15 * *',
    description: 'Biweekly reconciliation of anexo24_partidas against globalpc.',
  },
  wsdl_anexo24_pull: {
    syncType: 'wsdl_anexo24_pull',
    label: 'Anexo 24 · WSDL pull',
    cadenceMin: 24 * 60,
    critical: false,
    cron: '15 2 * * *',
    description: 'Nightly SOAP pull of Formato 53 (pending Mario endpoint confirmation).',
  },
  backfill_proveedor_rfc: {
    syncType: 'backfill_proveedor_rfc',
    label: 'Backfill · RFC proveedores',
    cadenceMin: 7 * 24 * 60,
    critical: false,
    cron: '0 3 * * 0',
  },
  backfill_transporte: {
    syncType: 'backfill_transporte',
    label: 'Backfill · transporte',
    cadenceMin: 7 * 24 * 60,
    critical: false,
    cron: '30 3 * * 0',
  },
  content_intel: {
    syncType: 'content_intel',
    label: 'Content Intel',
    cadenceMin: 24 * 60,
    critical: false,
    cron: '15 11 * * *',
  },
  completeness_checker: {
    syncType: 'completeness_checker',
    label: 'Completeness checker',
    cadenceMin: 24 * 60,
    critical: false,
    cron: '0 6 * * *',
    description: 'Daily QA pass over expediente completeness.',
  },
  anomaly_detector: {
    syncType: 'anomaly_detector',
    label: 'Detector de anomalías',
    cadenceMin: 24 * 60,
    critical: false,
    cron: '30 1 * * *',
    description: 'Runs after the nightly sync; alerts via Telegram, not via this verdict.',
  },
  regression_guard: {
    syncType: 'regression_guard',
    label: 'Regression guard',
    cadenceMin: 24 * 60,
    critical: false,
    description: 'Nightly post-sync regression guard; monitors coverage drift.',
  },
  auto_classifier: {
    syncType: 'auto_classifier',
    label: 'Clasificador automático',
    cadenceMin: 24 * 60,
    critical: false,
  },
  auto_invoice: {
    syncType: 'auto_invoice',
    label: 'Factura automática',
    cadenceMin: 24 * 60,
    critical: false,
  },
  reconciliation: {
    syncType: 'reconciliation',
    label: 'Reconciliación nocturna',
    cadenceMin: 24 * 60,
    critical: false,
  },
  tipo_cambio_monitor: {
    syncType: 'tipo_cambio_monitor',
    label: 'Tipo de cambio monitor',
    cadenceMin: 24 * 60,
    critical: false,
  },
  autonomy_tracker: {
    syncType: 'autonomy_tracker',
    label: 'Autonomy tracker',
    cadenceMin: 24 * 60,
    critical: false,
  },
  entradas_linkage: {
    syncType: 'entradas_linkage',
    label: 'Linkage de entradas',
    cadenceMin: 24 * 60,
    critical: false,
  },
  aduanet_watcher: {
    syncType: 'aduanet_watcher',
    label: 'AduaNet watcher',
    cadenceMin: 24 * 60,
    critical: false,
    description: 'Ad-hoc watcher; schedule varies by Arturo manual trigger.',
  },
}

/**
 * Look up a registry entry by sync_type. Returns null for unknown
 * sync types so callers can explicitly decide how to handle them
 * (report-only, never affect verdict).
 */
export function getSyncRegistryEntry(syncType: string): SyncRegistryEntry | null {
  return SYNC_REGISTRY[syncType] ?? null
}

/**
 * Classify a sync's health based on how long since its last success
 * relative to the registry cadence.
 *
 * Bands:
 *   · green   — minutesAgo ≤ cadence × 1.5 (one missed cycle of headroom)
 *   · amber   — cadence × 1.5 < minutesAgo ≤ cadence × 3
 *   · red     — minutesAgo > cadence × 3
 *   · unknown — sync_type not in the registry OR no success ever recorded
 *
 * `minutesAgo=null` means "never succeeded in the observed window." For
 * a KNOWN sync type this is red — it should have run by now. For an
 * UNKNOWN sync type it stays `unknown` and won't affect the verdict.
 */
export function classifyBySyncType(
  syncType: string,
  minutesAgo: number | null,
): SyncHealthBand {
  const entry = SYNC_REGISTRY[syncType]
  if (!entry) return 'unknown'
  if (minutesAgo == null) return 'red'
  const greenMax = entry.cadenceMin * 1.5
  const amberMax = entry.cadenceMin * 3
  if (minutesAgo <= greenMax) return 'green'
  if (minutesAgo <= amberMax) return 'amber'
  return 'red'
}

/**
 * How many minutes past the amber threshold a sync is. Zero if healthy.
 * Used by the dashboard to show "32 min atrasado" microcopy on red rows.
 */
export function minutesOverdue(
  syncType: string,
  minutesAgo: number | null,
): number {
  const entry = SYNC_REGISTRY[syncType]
  if (!entry || minutesAgo == null) return 0
  const amberMax = entry.cadenceMin * 3
  return Math.max(0, minutesAgo - amberMax)
}

/**
 * Reduce an array of bands to the worst band. Critical-only callers
 * should filter the array first; this helper doesn't know about
 * criticality.
 */
export function worstBand(bands: SyncHealthBand[]): SyncHealthBand {
  const order: Record<SyncHealthBand, number> = { green: 0, unknown: 0, amber: 1, red: 2 }
  let worst: SyncHealthBand = 'green'
  for (const b of bands) {
    if (order[b] > order[worst]) worst = b
  }
  return worst
}
