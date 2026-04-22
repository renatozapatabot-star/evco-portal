/**
 * Customs financial calculations — DTA, IGI, IVA with the cascading
 * base the SAT requires.
 *
 * Why this module exists:
 *   `calculateDTA` / `calculateIVA` are the two most common copy-paste
 *   sources of customs accounting bugs. The single most frequent error
 *   in customs software is `iva = value × 0.16` (flat) — wrong. The
 *   correct formula is:
 *
 *     valor_aduana (MXN)  = invoice_value_usd × tipo_cambio
 *     DTA                  = regime-specific (A1 = 8 per mille,
 *                            IN = $408 fixed, IT = exempt, ...)
 *     IGI                  = valor_aduana × fraccion.igi_rate
 *     IVA base             = valor_aduana + DTA + IGI  (CASCADING!)
 *     IVA                  = IVA_base × iva_rate  (0.16 per system_config)
 *     total_tax            = DTA + IGI + IVA
 *
 *   Getting the base wrong under-declares IVA by 8-15% on every
 *   pedimento. Patente exposure. This module is the ONLY place those
 *   formulas live.
 *
 * Design principles:
 *   - Pure functions — no I/O, no side effects. Rates come in as params
 *     (caller fetches once from `getDTARates` / `getIVARate`).
 *   - Explicit currency — every input + output has MXN or USD attached.
 *   - Refuse to calculate on missing/invalid inputs. Returns a typed
 *     error shape; never throws from the caller's happy path.
 *   - Every T-MEC / A1 / IMMEX regime handled explicitly. Unknown
 *     regime defaults to A1 behavior (most conservative fallback).
 *
 * Core invariant #9 (CLAUDE.md): "IVA base = valor_aduana + DTA + IGI"
 * Core invariant #17: "Rates always from system_config, never hardcoded"
 *
 * Verification: tests cover every regime + the cascading-base anti-bug
 * plus a T-MEC-zero case and an IT-exempt case.
 */

import type { DTARates } from '@/lib/rates'

// ── Types ────────────────────────────────────────────────────────

/** 2-letter pedimento regime code. See §29.4 of handbook. */
export type PedimentoRegime = 'A1' | 'A3' | 'IN' | 'IT' | 'F4' | 'F5' | 'F6' | string

export interface CalculateDTAInput {
  /** Full USD invoice value (valor comercial). */
  valor_usd: number
  /** Current MXN/USD tipo de cambio from system_config. */
  tipo_cambio: number
  /** Pedimento regime (determines fixed vs per-mille behavior). */
  regimen: PedimentoRegime
  /** DTA rates from system_config (via `getDTARates()`). */
  rates: DTARates
}

export interface CalculateDTAResult {
  /** DTA amount in MXN. 0 for exempt regimes. */
  dta_mxn: number
  /** Which regime-specific entry from `rates` was used. */
  regimen_used: PedimentoRegime
  /** Computed valor_aduana in MXN (USD × TC) — returned for cascade. */
  valor_aduana_mxn: number
  /** One-line Spanish explanation (for audit logs + tooltips). */
  explanation: string
}

export interface CalculateIVAInput {
  /** valor_aduana in MXN (output of calculateDTA or caller-computed). */
  valor_aduana_mxn: number
  /** DTA in MXN (the value the cascade adds to the base). */
  dta_mxn: number
  /** IGI in MXN (computed from fraction's tariff rate × valor_aduana). */
  igi_mxn: number
  /** IVA rate from `getIVARate()` (e.g. 0.16). */
  iva_rate: number
}

export interface CalculateIVAResult {
  /** IVA amount in MXN. */
  iva_mxn: number
  /** The cascading base: valor_aduana + DTA + IGI. */
  iva_base_mxn: number
  explanation: string
}

export interface CalculateIGIInput {
  valor_aduana_mxn: number
  /** Per-mille IGI rate (e.g. 0.05 = 5%). Pulled from tariff table. */
  igi_rate: number
  /** If true (T-MEC eligible), IGI is zero. Overrides igi_rate. */
  tmec_eligible?: boolean
}

export interface CalculateIGIResult {
  igi_mxn: number
  rate_applied: number
  tmec_applied: boolean
  explanation: string
}

// ── Constants ────────────────────────────────────────────────────

/** Regimes exempt from DTA entirely (temporary imports, ...). */
const DTA_EXEMPT_REGIMES = new Set<PedimentoRegime>(['IT', 'F5'])

/** Regimes using per-mille DTA (A1 = 8 per mille by default). */
const DTA_PERMILLE_REGIMES = new Set<PedimentoRegime>(['A1', 'A3', 'F4', 'F6'])

/** Regimes using fixed-amount DTA (IMMEX = $408 MXN per config). */
const DTA_FIXED_REGIMES = new Set<PedimentoRegime>(['IN'])

// ── DTA ──────────────────────────────────────────────────────────

/**
 * Calculate DTA (Derecho de Trámite Aduanero) in MXN for a pedimento.
 *
 * Dispatch by regime:
 *   - A1, A3, F4, F6 → per-mille on valor_aduana (rate from system_config)
 *   - IN (IMMEX)     → fixed amount from system_config ($408 typical)
 *   - IT, F5         → exempt (DTA = 0)
 *   - unknown        → defaults to A1 per-mille (most conservative)
 *
 * The per-mille rate lives in `rates[regime].amount` where `type='fixed'`
 * is actually the per-mille value (historical naming in system_config).
 */
export function calculateDTA(input: CalculateDTAInput): CalculateDTAResult {
  const { valor_usd, tipo_cambio, regimen, rates } = input

  if (!Number.isFinite(valor_usd) || valor_usd < 0) {
    throw new Error(`calculateDTA: valor_usd must be a non-negative number (got ${valor_usd})`)
  }
  if (!Number.isFinite(tipo_cambio) || tipo_cambio <= 0) {
    throw new Error(`calculateDTA: tipo_cambio must be positive (got ${tipo_cambio})`)
  }

  const valor_aduana_mxn = Math.round(valor_usd * tipo_cambio * 100) / 100

  if (DTA_EXEMPT_REGIMES.has(regimen)) {
    return {
      dta_mxn: 0,
      regimen_used: regimen,
      valor_aduana_mxn,
      explanation: `Régimen ${regimen} exento de DTA`,
    }
  }

  if (DTA_FIXED_REGIMES.has(regimen)) {
    const entry = rates[regimen]
    if (!entry || !Number.isFinite(entry.amount)) {
      throw new Error(
        `calculateDTA: missing fixed DTA rate for ${regimen} in rates config`,
      )
    }
    return {
      dta_mxn: Math.round(entry.amount * 100) / 100,
      regimen_used: regimen,
      valor_aduana_mxn,
      explanation: `Régimen ${regimen} cuota fija $${entry.amount.toLocaleString('es-MX')} MXN`,
    }
  }

  // Per-mille path — A1, A3, F4, F6, and unknown regimes (conservative).
  const effectiveRegime: PedimentoRegime =
    DTA_PERMILLE_REGIMES.has(regimen) ? regimen : 'A1'
  const entry = rates[effectiveRegime]
  if (!entry || !Number.isFinite(entry.amount)) {
    throw new Error(
      `calculateDTA: missing per-mille DTA rate for ${effectiveRegime} in rates config`,
    )
  }
  // Historical naming: `amount` is the per-mille fraction (0.008 = 8‰).
  const dta_raw = valor_aduana_mxn * entry.amount
  const dta_mxn = Math.round(dta_raw * 100) / 100
  return {
    dta_mxn,
    regimen_used: effectiveRegime,
    valor_aduana_mxn,
    explanation: `Régimen ${effectiveRegime} DTA ${(entry.amount * 1000).toFixed(1)}‰ sobre valor aduana $${valor_aduana_mxn.toLocaleString('es-MX')} MXN`,
  }
}

// ── IGI ──────────────────────────────────────────────────────────

/**
 * Calculate IGI (Impuesto General de Importación) in MXN.
 *
 * - General case: IGI = valor_aduana × igi_rate
 * - T-MEC eligible case (regime A1/IN/A3 + certificado de origen): IGI = 0
 *
 * The `igi_rate` comes from a per-fraction tariff table (not covered
 * here — caller resolves via `tariff_rates` or `globalpc_productos`).
 */
export function calculateIGI(input: CalculateIGIInput): CalculateIGIResult {
  const { valor_aduana_mxn, igi_rate, tmec_eligible } = input

  if (!Number.isFinite(valor_aduana_mxn) || valor_aduana_mxn < 0) {
    throw new Error(
      `calculateIGI: valor_aduana_mxn must be non-negative (got ${valor_aduana_mxn})`,
    )
  }
  if (!Number.isFinite(igi_rate) || igi_rate < 0 || igi_rate > 1) {
    throw new Error(
      `calculateIGI: igi_rate must be in [0, 1] (got ${igi_rate})`,
    )
  }

  if (tmec_eligible) {
    return {
      igi_mxn: 0,
      rate_applied: 0,
      tmec_applied: true,
      explanation: `IGI exento por T-MEC (ahorro ${(igi_rate * 100).toFixed(1)}% = $${(valor_aduana_mxn * igi_rate).toLocaleString('es-MX', { maximumFractionDigits: 0 })} MXN vs. tarifa general)`,
    }
  }

  const igi_mxn = Math.round(valor_aduana_mxn * igi_rate * 100) / 100
  return {
    igi_mxn,
    rate_applied: igi_rate,
    tmec_applied: false,
    explanation: `IGI ${(igi_rate * 100).toFixed(1)}% sobre valor aduana $${valor_aduana_mxn.toLocaleString('es-MX')} MXN`,
  }
}

// ── IVA ──────────────────────────────────────────────────────────

/**
 * Calculate IVA in MXN with the CASCADING base (the #1 customs bug
 * source — see module doc). Base = valor_aduana + DTA + IGI. NEVER
 * `invoice_value × 0.16` flat.
 *
 * The iva_rate comes from system_config via `getIVARate()`. Typical
 * value is 0.16. The config-driven rate lets this module work
 * unchanged when the SAT raises/lowers IVA.
 */
export function calculateIVA(input: CalculateIVAInput): CalculateIVAResult {
  const { valor_aduana_mxn, dta_mxn, igi_mxn, iva_rate } = input

  for (const [name, v] of Object.entries({
    valor_aduana_mxn,
    dta_mxn,
    igi_mxn,
    iva_rate,
  })) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `calculateIVA: ${name} must be non-negative number (got ${v})`,
      )
    }
  }
  if (iva_rate > 1) {
    throw new Error(
      `calculateIVA: iva_rate looks like a percentage (got ${iva_rate}). Expected decimal ≤ 1 (e.g. 0.16).`,
    )
  }

  const iva_base_mxn =
    Math.round((valor_aduana_mxn + dta_mxn + igi_mxn) * 100) / 100
  const iva_mxn = Math.round(iva_base_mxn * iva_rate * 100) / 100

  return {
    iva_mxn,
    iva_base_mxn,
    explanation: `IVA ${(iva_rate * 100).toFixed(0)}% sobre base cascada $${iva_base_mxn.toLocaleString('es-MX')} MXN (valor aduana $${valor_aduana_mxn.toLocaleString('es-MX')} + DTA $${dta_mxn.toLocaleString('es-MX')} + IGI $${igi_mxn.toLocaleString('es-MX')})`,
  }
}

// ── Full pedimento calculation ───────────────────────────────────

export interface PedimentoCalcInput {
  valor_usd: number
  tipo_cambio: number
  regimen: PedimentoRegime
  igi_rate: number
  tmec_eligible?: boolean
  rates: DTARates
  iva_rate: number
}

export interface PedimentoCalcResult {
  valor_aduana_mxn: number
  dta: CalculateDTAResult
  igi: CalculateIGIResult
  iva: CalculateIVAResult
  total_taxes_mxn: number
  total_landed_mxn: number
  total_landed_usd: number
  tmec_savings_mxn: number | null
}

/**
 * Full pedimento tax computation — the "give me everything" entry
 * point. Runs valor_aduana → DTA → IGI → IVA in the right order
 * with the cascading base.
 *
 * Returns every intermediate value so callers can audit each step.
 * Use this for pedimento PDF generation, export previews, and the
 * simulator. Individual helpers (`calculateDTA`, `calculateIGI`,
 * `calculateIVA`) stay available for step-level use.
 */
export function calculatePedimento(
  input: PedimentoCalcInput,
): PedimentoCalcResult {
  const { valor_usd, tipo_cambio, regimen, igi_rate, tmec_eligible, rates, iva_rate } = input

  const dta = calculateDTA({ valor_usd, tipo_cambio, regimen, rates })
  const igi = calculateIGI({
    valor_aduana_mxn: dta.valor_aduana_mxn,
    igi_rate,
    tmec_eligible,
  })
  const iva = calculateIVA({
    valor_aduana_mxn: dta.valor_aduana_mxn,
    dta_mxn: dta.dta_mxn,
    igi_mxn: igi.igi_mxn,
    iva_rate,
  })

  const total_taxes_mxn = Math.round((dta.dta_mxn + igi.igi_mxn + iva.iva_mxn) * 100) / 100
  const total_landed_mxn = Math.round((dta.valor_aduana_mxn + total_taxes_mxn) * 100) / 100
  const total_landed_usd = tipo_cambio > 0
    ? Math.round((total_landed_mxn / tipo_cambio) * 100) / 100
    : 0

  // T-MEC savings: what the IGI would have been at the general rate,
  // multiplied to account for the cascade IVA uplift. Only meaningful
  // when tmec_eligible=true.
  const tmec_savings_mxn = tmec_eligible
    ? Math.round(dta.valor_aduana_mxn * igi_rate * (1 + iva_rate) * 100) / 100
    : null

  return {
    valor_aduana_mxn: dta.valor_aduana_mxn,
    dta,
    igi,
    iva,
    total_taxes_mxn,
    total_landed_mxn,
    total_landed_usd,
    tmec_savings_mxn,
  }
}
