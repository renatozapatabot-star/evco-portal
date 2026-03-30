import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export interface ApiKeyData {
  company_id: string
  key_name: string
  permissions: string
}

export async function authenticateApiKey(request: NextRequest): Promise<ApiKeyData | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.substring(7)
  const tokenHash = createHash('sha256').update(token).digest('hex')

  const { data } = await supabase.from('api_keys')
    .select('company_id, key_name, permissions, revoked')
    .eq('key_hash', tokenHash).single()

  if (!data || data.revoked) return null

  // Update last_used
  await supabase.from('api_keys').update({ last_used: new Date().toISOString() }).eq('key_hash', tokenHash)

  return { company_id: data.company_id, key_name: data.key_name, permissions: data.permissions || 'read' }
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized — provide Bearer token in Authorization header' }, { status: 401 })
}
