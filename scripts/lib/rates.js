// scripts/lib/rates.js
// Shared rate functions — single source of truth for all pipeline scripts.
// Reads from system_config table. Never hardcodes rates.

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

/**
 * Get DTA rates from system_config.
 * Returns { A1: { rate, description }, IMD: { rate, description }, ... }
 * Refuses to return if config is expired (valid_to < today).
 */
async function getDTARates() {
  const { data, error } = await supabase
    .from('system_config')
    .select('value, valid_to')
    .eq('key', 'dta_rates')
    .single()

  if (error || !data) {
    throw new Error(`getDTARates failed: ${error?.message || 'no config found'}`)
  }

  if (data.valid_to && new Date(data.valid_to) < new Date()) {
    throw new Error(`DTA rates expired on ${data.valid_to} — update system_config before proceeding`)
  }

  return data.value
}

/**
 * Get current exchange rate (MXN/USD) from system_config.
 * Returns { rate: number, source: string, updated_at: string }
 * Refuses to return if config is expired.
 */
async function getExchangeRate() {
  const { data, error } = await supabase
    .from('system_config')
    .select('value, valid_to')
    .eq('key', 'banxico_exchange_rate')
    .single()

  if (error || !data) {
    throw new Error(`getExchangeRate failed: ${error?.message || 'no config found'}`)
  }

  if (data.valid_to && new Date(data.valid_to) < new Date()) {
    throw new Error(`Exchange rate expired on ${data.valid_to} — update system_config before proceeding`)
  }

  return data.value
}

/**
 * Get IVA rate from system_config.
 * Returns { rate: number } (e.g. { rate: 0.16 })
 */
async function getIVARate() {
  const { data, error } = await supabase
    .from('system_config')
    .select('value, valid_to')
    .eq('key', 'iva_rate')
    .single()

  if (error || !data) {
    throw new Error(`getIVARate failed: ${error?.message || 'no config found'} — IVA rate MUST come from system_config`)
  }

  if (data.valid_to && new Date(data.valid_to) < new Date()) {
    throw new Error(`IVA rate expired on ${data.valid_to} — update system_config before proceeding`)
  }

  return data.value
}

/**
 * Convenience: get all rates needed for a pedimento calculation.
 * Returns { exchangeRate, dtaRates, ivaRate }
 */
async function getAllRates() {
  const [exchangeData, dtaRates, ivaData] = await Promise.all([
    getExchangeRate(),
    getDTARates(),
    getIVARate(),
  ])

  return {
    exchangeRate: exchangeData.rate,
    exchangeSource: exchangeData.source,
    dtaRates,
    ivaRate: ivaData.rate,
  }
}

module.exports = { getDTARates, getExchangeRate, getIVARate, getAllRates, supabase }
