/**
 * Computed-fallback estimator for DTA/IGI/IVA on embarques that haven't
 * been synced from AduanaNet yet (the scraper window is rolling 30 days).
 * Used by the pedimento-pdf route when cbpFacturas is empty so the PDF
 * shows numbers labelled "Estimado" instead of bare "Pendiente".
 *
 * IVA base per CLAUDE.md invariant: valor_aduana + DTA + IGI (cascading).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getDTARates, getIVARate } from '@/lib/rates'

export interface PartidaForEstimate {
  /** HS / fracción arancelaria — the join key into tariff_rates. */
  fraccion: string | null
  /** Per-partida value in MXN (already converted from USD if needed). */
  valor_partida_mxn: number
}

export interface EstimateInput {
  regimen: string | null
  /** Aggregated valor aduana in MXN across all partidas + incrementables. */
  valor_aduana_mxn: number
  partidas: PartidaForEstimate[]
}

export interface EstimateResult {
  dta: number
  igi: number | null
  iva: number | null
  /**
   * 'estimated' — DTA + IGI inferred from tariff_rates table.
   * 'estimated-partial' — DTA computed but IGI/IVA insufficient fracción coverage.
   * 'unknown' — couldn't compute even DTA (régimen missing from system_config).
   */
  source: 'estimated' | 'estimated-partial' | 'unknown'
  /** % of partidas whose fracción resolved to a tariff_rates entry. */
  fraccionCoveragePct: number
}

/**
 * @param supabase admin Supabase client
 * @param input describes the régimen, total valor aduana, and per-partida fracciones
 */
export async function estimateIgiIva(
  supabase: SupabaseClient,
  input: EstimateInput,
): Promise<EstimateResult> {
  // DTA — fixed amount per régimen from system_config.
  let dta = 0
  let regimenKnown = false
  if (input.regimen) {
    try {
      const rates = await getDTARates()
      const entry = rates[input.regimen] ?? rates['A1']
      if (entry?.type === 'fixed') {
        dta = entry.amount
        regimenKnown = true
      }
    } catch {
      // system_config missing — leave dta = 0
    }
  }

  // IGI — per-fraccion lookup against tariff_rates. Sum partial coverage.
  const fracciones = Array.from(
    new Set(input.partidas.map(p => p.fraccion).filter((f): f is string => !!f && f.length > 0)),
  )
  let rateMap = new Map<string, number>()
  if (fracciones.length > 0) {
    const { data } = await supabase
      .from('tariff_rates')
      .select('fraccion, igi_rate')
      .in('fraccion', fracciones)
    rateMap = new Map(((data ?? []) as Array<{ fraccion: string; igi_rate: number }>).map(r => [r.fraccion, Number(r.igi_rate) || 0]))
  }

  let igi = 0
  let coveredPartidas = 0
  for (const p of input.partidas) {
    if (p.fraccion && rateMap.has(p.fraccion)) {
      igi += p.valor_partida_mxn * (rateMap.get(p.fraccion) ?? 0)
      coveredPartidas++
    }
  }
  const fraccionCoveragePct = input.partidas.length > 0
    ? Math.round((coveredPartidas / input.partidas.length) * 100)
    : 0

  // IVA — compute only if we have meaningful IGI coverage. Otherwise the IVA
  // base would be wrong by an unknown delta and labelling it "Estimado" lies.
  let iva: number | null = null
  if (fraccionCoveragePct >= 80) {
    try {
      const ivaRate = await getIVARate()
      iva = ivaRate * (input.valor_aduana_mxn + dta + igi)
    } catch {
      iva = null
    }
  }

  let source: EstimateResult['source']
  if (!regimenKnown && fraccionCoveragePct === 0) source = 'unknown'
  else if (iva == null) source = 'estimated-partial'
  else source = 'estimated'

  return {
    dta,
    igi: fraccionCoveragePct >= 80 ? igi : null,
    iva,
    source,
    fraccionCoveragePct,
  }
}
