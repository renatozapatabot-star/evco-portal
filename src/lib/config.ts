import { createClient } from '@supabase/supabase-js'

export type SignupMode = 'self_service' | 'gated'

let _cached: { value: SignupMode; at: number } | null = null

export async function getSignupMode(): Promise<SignupMode> {
  if (_cached && Date.now() - _cached.at < 60_000) return _cached.value

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await sb.from('system_config').select('value').eq('key', 'signup_mode').maybeSingle()

  // Handle both cases: raw string OR JSON-wrapped string with surrounding quotes
  let raw = data?.value
  if (typeof raw === 'string') {
    if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1)
  } else {
    raw = 'gated'
  }
  const validModes: SignupMode[] = ['self_service', 'gated']
  const mode: SignupMode = validModes.includes(raw as SignupMode) ? (raw as SignupMode) : 'gated'
  _cached = { value: mode, at: Date.now() }
  return mode
}
