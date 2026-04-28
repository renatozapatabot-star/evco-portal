import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey, unauthorized } from '@/lib/api-auth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest, { params }: { params: Promise<{ trafico: string }> }) {
  const auth = await authenticateApiKey(request)
  if (!auth) return unauthorized()

  const { trafico } = await params
  // P0-A3: tenant fence — without the company_id filter, any partner
  // API key could read another tenant's crossing prediction by
  // guessing trafico_id. 404 (not 403) on cross-tenant per
  // tenant-isolation.md catalog rule.
  const { data } = await supabase
    .from('crossing_predictions')
    .select('*')
    .eq('trafico_id', trafico)
    .eq('company_id', auth.company_id)
    .maybeSingle()
  if (!data) return NextResponse.json({ error: 'No prediction found' }, { status: 404 })
  return NextResponse.json(data)
}
