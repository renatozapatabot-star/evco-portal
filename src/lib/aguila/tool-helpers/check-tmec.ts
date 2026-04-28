/**
 * check_tmec_eligibility — given a fracción, origin country, and optional
 * valor_aduana (MXN), return T-MEC eligibility signal + estimated savings.
 *
 * Savings model:
 *   savings_mxn = valor_aduana_mxn × igi_rate    (T-MEC waives IGI → 0)
 *
 * The `tariff_rates` table stores the general IGI rate per fracción. If
 * the fracción has no rate on file, we return a calm "requiere
 * verificación" response — never a fabricated rate.
 *
 * USMCA origins: USA, CAN, MEX (ISO alpha-3 or common Spanish variants
 * normalized).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const USMCA_ORIGINS = new Set(['USA', 'CAN', 'MEX', 'US', 'CA', 'MX', 'ESTADOS UNIDOS', 'CANADA', 'MEXICO'])

export interface TmecEligibilityResult {
  fraccion: string
  origin_normalized: string | null
  usmca_origin: boolean
  igi_rate: number | null
  igi_rate_source: string | null
  sample_count: number | null
  estimated_savings_mxn: number | null
  verdict_es:
    | 'elegible_con_certificado'
    | 'no_elegible_por_origen'
    | 'requiere_verificacion'
    | 'fraccion_invalida'
  rationale_es: string
  next_steps_es: string[]
}

export interface CheckTmecInput {
  fraccion: string
  origin: string
  valorAduanaMxn?: number
}

export interface CheckTmecResponse {
  success: boolean
  data: TmecEligibilityResult | null
  error: string | null
}

const FRACCION_REGEX = /^\d{4}\.\d{2}\.\d{2}$/

function normalizeOrigin(raw: string): string | null {
  if (!raw) return null
  const trimmed = raw
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  return trimmed || null
}

export async function checkTmecEligibility(
  supabase: SupabaseClient,
  input: CheckTmecInput,
): Promise<CheckTmecResponse> {
  const fraccion = (input.fraccion ?? '').trim()
  const origin = normalizeOrigin(input.origin ?? '')

  if (!FRACCION_REGEX.test(fraccion)) {
    return {
      success: true,
      data: {
        fraccion,
        origin_normalized: origin,
        usmca_origin: false,
        igi_rate: null,
        igi_rate_source: null,
        sample_count: null,
        estimated_savings_mxn: null,
        verdict_es: 'fraccion_invalida',
        rationale_es: `La fracción "${input.fraccion}" no cumple el formato SAT XXXX.XX.XX.`,
        next_steps_es: ['Corrige el formato y vuelve a consultar.'],
      },
      error: null,
    }
  }

  const usmca = origin !== null && USMCA_ORIGINS.has(origin)

  const { data: rateRow, error } = await supabase
    .from('tariff_rates')
    .select('fraccion, igi_rate, sample_count, source')
    .eq('fraccion', fraccion)
    .maybeSingle()

  if (error) return { success: false, data: null, error: `tariff_rates:${error.message}` }

  const igiRate = rateRow?.igi_rate ?? null
  const sampleCount = rateRow?.sample_count ?? null
  const source = rateRow?.source ?? null

  if (!usmca) {
    return {
      success: true,
      data: {
        fraccion,
        origin_normalized: origin,
        usmca_origin: false,
        igi_rate: igiRate,
        igi_rate_source: source,
        sample_count: sampleCount,
        estimated_savings_mxn: null,
        verdict_es: 'no_elegible_por_origen',
        rationale_es: `Origen "${input.origin}" queda fuera de USMCA — T-MEC no aplica.`,
        next_steps_es: [
          'Consulta el arancel MFN de la fracción.',
          'Valida si aplica otro acuerdo (TLCUEM, CPTPP) con tu OCA.',
        ],
      },
      error: null,
    }
  }

  if (igiRate === null) {
    return {
      success: true,
      data: {
        fraccion,
        origin_normalized: origin,
        usmca_origin: true,
        igi_rate: null,
        igi_rate_source: null,
        sample_count: null,
        estimated_savings_mxn: null,
        verdict_es: 'requiere_verificacion',
        rationale_es: `Origen USMCA detectado pero la tasa IGI de ${fraccion} aún no está en el catálogo de tarifas.`,
        next_steps_es: [
          'Solicita al OCA la clasificación + tasa IGI vigente.',
          'Confirma certificado de origen T-MEC con el proveedor.',
        ],
      },
      error: null,
    }
  }

  const savings =
    input.valorAduanaMxn !== undefined && input.valorAduanaMxn > 0
      ? Math.round(input.valorAduanaMxn * igiRate * 100) / 100
      : null

  return {
    success: true,
    data: {
      fraccion,
      origin_normalized: origin,
      usmca_origin: true,
      igi_rate: igiRate,
      igi_rate_source: source,
      sample_count: sampleCount,
      estimated_savings_mxn: savings,
      verdict_es: 'elegible_con_certificado',
      rationale_es:
        savings !== null
          ? `Con certificado T-MEC vigente, IGI pasa de ${(igiRate * 100).toFixed(2)}% a 0% — ahorro estimado ${savings.toFixed(2)} MXN sobre ${input.valorAduanaMxn?.toFixed(2)} MXN de valor aduana.`
          : `Con certificado T-MEC vigente, IGI pasa de ${(igiRate * 100).toFixed(2)}% a 0%. Proporciona valor_aduana en MXN para estimar ahorro.`,
      next_steps_es: [
        'Confirma certificado de origen T-MEC con el proveedor.',
        'Verifica regla de origen (cambio de capítulo o VCR) con OCA.',
      ],
    },
    error: null,
  }
}
