/**
 * PORTAL · Broker-fee estimator.
 *
 * Pure functions. No DB, no env, no side effects.
 *
 * Industry midpoints per Renato IV's spec (2026-04-19):
 *   standard imports (A1, A3, A4, V1, BO, NULL)  → $125 USD/pedimento
 *   IMMEX/specialty (IN, IMD, ITE, ITR, RT, AF…) → $400 USD/pedimento
 *
 * When real billing data is present in econta_facturas, prefer that.
 * The estimator is the floor that lets the dashboard exist while
 * Anabel's eConta sync catches up.
 */

import type { FeeRegime } from './types'

export const FEE_USD_STANDARD = 125
export const FEE_USD_IMMEX = 400

/**
 * IMMEX / temporal-import claves. These are the regimes where the broker
 * does the deeper compliance lift (Anexo 24, RFC validation, suppliers,
 * etc.) and the fee runs $200-$600. Source: SAT pedimento clave catalog.
 */
const IMMEX_CLAVES = new Set([
  'IN', // Internación temporal IMMEX
  'IMD', // Internación temporal IMMEX (depósito)
  'ITE', // Internación temporal de exportación
  'ITR', // Internación temporal de retorno
  'RT', // Retorno
  'AF', // Cambio de régimen IMMEX
  'BM', // Bonded merchandise
  'F4', // Cambio régimen IMMEX
  'IM', // Internación de mercancía IMMEX
])

/**
 * Definitive / "vista" claves. These run the cheaper $80-$200 range.
 */
const STANDARD_CLAVES = new Set([
  'A1', // Definitiva
  'A3', // Rectificación
  'A4', // Cambio régimen definitivo
  'V1', // Vista temporal
  'BO', // Bonded out
])

/**
 * Classify a pedimento clave into our two-bucket fee regime.
 * NULL / unknown claves default to standard so we never overestimate.
 */
export function classifyRegime(clavePedimento: string | null | undefined): FeeRegime {
  if (!clavePedimento) return 'standard'
  const k = String(clavePedimento).trim().toUpperCase()
  if (IMMEX_CLAVES.has(k)) return 'immex'
  if (STANDARD_CLAVES.has(k)) return 'standard'
  // Unknown clave → standard (safer floor)
  return 'standard'
}

/**
 * Estimated USD fee for a single pedimento.
 */
export function estimateFeeUSD(clavePedimento: string | null | undefined): number {
  return classifyRegime(clavePedimento) === 'immex' ? FEE_USD_IMMEX : FEE_USD_STANDARD
}

/**
 * Roll up an array of (clavePedimento) into estimated totals.
 */
export function estimateFromClaves(
  claves: Array<string | null | undefined>,
): { count: number; standardCount: number; immexCount: number; totalUSD: number } {
  let standard = 0
  let immex = 0
  for (const c of claves) {
    if (classifyRegime(c) === 'immex') immex++
    else standard++
  }
  return {
    count: standard + immex,
    standardCount: standard,
    immexCount: immex,
    totalUSD: standard * FEE_USD_STANDARD + immex * FEE_USD_IMMEX,
  }
}

/**
 * Convert a USD amount to MXN at the given rate.
 * Returns 0 for non-finite inputs to keep dashboards stable.
 */
export function usdToMXN(usd: number, exchangeRateMXNperUSD: number): number {
  if (!Number.isFinite(usd) || !Number.isFinite(exchangeRateMXNperUSD)) return 0
  return usd * exchangeRateMXNperUSD
}

/**
 * Month-over-month % change. Null when prior is zero (undefined growth).
 */
export function pctChange(current: number, prior: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(prior)) return null
  if (prior === 0) return null
  return ((current - prior) / prior) * 100
}
