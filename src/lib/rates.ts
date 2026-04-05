import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface DTARates {
  A1: { rate: number; type: 'percent' }
  IN: { type: 'fixed'; amount: number }
  IT: { type: 'fixed'; amount: number }
}

export async function getDTARates(): Promise<DTARates> {
  const { data } = await supabase
    .from('system_config')
    .select('value, valid_to')
    .eq('key', 'dta_rates')
    .single()

  if (!data) throw new Error('DTA rates not found in system_config')
  if (data.valid_to && new Date(data.valid_to) < new Date()) {
    throw new Error('DTA rates expired — update system_config')
  }

  return data.value as DTARates
}

export async function getIVARate(): Promise<number> {
  const { data } = await supabase
    .from('system_config')
    .select('value, valid_to')
    .eq('key', 'iva_rate')
    .single()

  if (!data) throw new Error('IVA rate not found in system_config')
  if (data.valid_to && new Date(data.valid_to) < new Date()) {
    throw new Error('IVA rate expired — update system_config')
  }

  return data.value?.rate as number
}

export async function getExchangeRate(): Promise<{ rate: number; date: string; source: string }> {
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'banxico_exchange_rate')
    .single()

  if (!data?.value?.rate) {
    throw new Error('Exchange rate not found in system_config — update banxico_exchange_rate')
  }

  return {
    rate: data.value.rate,
    date: data.value.date,
    source: data.value.source || 'system_config'
  }
}
