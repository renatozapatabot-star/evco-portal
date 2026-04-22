/**
 * validate_pedimento — stateless pedimento sanity check. Runs SAT-format
 * regex, IVA-base cascade math (valor_aduana + DTA + IGI) × iva_rate,
 * currency-label presence, and fracción dot-form if provided.
 *
 * Refuses to compute if rates are expired or missing — callers get a
 * clear error instead of a silent wrong answer.
 *
 * Does NOT hit the traficos/pedimentos tables — this is a pure validator
 * for numbers the user (or another tool) provides. Pair with
 * `analyze_pedimento` if you need to resolve a pedimento to its trafico.
 */

import { getDTARates, getIVARate } from '@/lib/rates'

export interface ValidationCheck {
  id: string
  label_es: string
  passed: boolean
  detail_es: string
}

export interface ValidatePedimentoResult {
  pedimento_number: string
  overall_pass: boolean
  checks: ValidationCheck[]
  computed_iva_mxn: number | null
  iva_rate_used: number | null
}

export interface ValidatePedimentoInput {
  pedimentoNumber: string
  valorAduanaMxn?: number
  igiMxn?: number
  dtaKey?: string
  providedIvaMxn?: number
  currency?: 'MXN' | 'USD'
  fraccion?: string
}

export interface ValidatePedimentoResponse {
  success: boolean
  data: ValidatePedimentoResult | null
  error: string | null
}

const PEDIMENTO_REGEX = /^\d{2}\s\d{2}\s\d{4}\s\d{7}$/
const FRACCION_REGEX = /^\d{4}\.\d{2}\.\d{2}$/

function pushCheck(
  list: ValidationCheck[],
  id: string,
  label_es: string,
  passed: boolean,
  detail_es: string,
): void {
  list.push({ id, label_es, passed, detail_es })
}

export async function validatePedimento(
  input: ValidatePedimentoInput,
): Promise<ValidatePedimentoResponse> {
  const clean = (input.pedimentoNumber ?? '').trim()
  if (!clean) return { success: false, data: null, error: 'invalid_pedimentoNumber' }

  const checks: ValidationCheck[] = []

  pushCheck(
    checks,
    'format_spaces',
    'Formato SAT con espacios',
    PEDIMENTO_REGEX.test(clean),
    PEDIMENTO_REGEX.test(clean)
      ? `Pedimento ${clean} cumple el formato DD AD PPPP SSSSSSS.`
      : `Pedimento debe seguir el formato "DD AD PPPP SSSSSSS" con espacios — recibido "${clean}".`,
  )

  if (input.fraccion !== undefined) {
    const fracOk = FRACCION_REGEX.test(input.fraccion)
    pushCheck(
      checks,
      'fraccion_dots',
      'Fracción con puntos',
      fracOk,
      fracOk
        ? `Fracción ${input.fraccion} en formato canónico XXXX.XX.XX.`
        : `La fracción debe conservar puntos: XXXX.XX.XX — recibido "${input.fraccion}".`,
    )
  }

  if (input.currency !== undefined) {
    const currencyOk = input.currency === 'MXN' || input.currency === 'USD'
    pushCheck(
      checks,
      'currency_label',
      'Moneda etiquetada',
      currencyOk,
      currencyOk
        ? `Moneda ${input.currency} declarada explícitamente.`
        : `La moneda debe ser MXN o USD — recibido "${input.currency}".`,
    )
  }

  const shouldCheckIva =
    input.valorAduanaMxn !== undefined &&
    input.igiMxn !== undefined &&
    input.providedIvaMxn !== undefined

  let computedIva: number | null = null
  let ivaRate: number | null = null

  if (shouldCheckIva) {
    try {
      ivaRate = await getIVARate()
      const dtaKey = (input.dtaKey ?? 'A1').toUpperCase()
      const dtaRates = await getDTARates()
      const dtaAmount = dtaRates[dtaKey]?.amount ?? dtaRates.A1.amount
      const base = input.valorAduanaMxn! + dtaAmount + input.igiMxn!
      computedIva = Math.round(base * ivaRate * 100) / 100
      const delta = Math.abs(computedIva - input.providedIvaMxn!)
      const tolerance = Math.max(5, computedIva * 0.001)
      const ivaOk = delta <= tolerance
      pushCheck(
        checks,
        'iva_cascade_base',
        'IVA sobre base en cascada',
        ivaOk,
        ivaOk
          ? `IVA ${computedIva.toFixed(2)} MXN coincide con la base (valor_aduana + DTA + IGI) × ${(ivaRate * 100).toFixed(2)}%.`
          : `IVA calculado ${computedIva.toFixed(2)} MXN vs reportado ${input.providedIvaMxn!.toFixed(2)} MXN — diferencia ${delta.toFixed(2)} MXN fuera de tolerancia.`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, data: null, error: `rates:${msg}` }
    }
  }

  const overall = checks.every(c => c.passed)
  return {
    success: true,
    data: {
      pedimento_number: clean,
      overall_pass: overall,
      checks,
      computed_iva_mxn: computedIva,
      iva_rate_used: ivaRate,
    },
    error: null,
  }
}
