import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey, unauthorized } from '@/lib/api-auth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request)
  if (!auth) return unauthorized()

  const severity = request.nextUrl.searchParams.get('severity')
  let query = supabase.from('compliance_predictions')
    .select('*').eq('company_id', auth.company_id).eq('resolved', false)
    .order('due_date', { ascending: true })
  if (severity) query = query.eq('severity', severity)

  const { data } = await query.limit(100)
  return NextResponse.json({ alerts: data || [], count: data?.length || 0 })
}
