import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey, unauthorized } from '@/lib/api-auth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request)
  if (!auth) return unauthorized()

  const { data } = await supabase.from('client_benchmarks')
    .select('*').eq('company_id', auth.company_id)
    .order('period', { ascending: false }).limit(12)

  return NextResponse.json({ benchmarks: data || [], company_id: auth.company_id })
}
