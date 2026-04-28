import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey, unauthorized } from '@/lib/api-auth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const auth = await authenticateApiKey(request)
  if (!auth) return unauthorized()

  const { name } = await params
  // P0-A3: tenant fence — pre-fix the ilike search ran across every
  // tenant's supplier_network rows. A partner API key could enumerate
  // another tenant's vendor list by querying any supplier name.
  // Network-intelligence aggregation (cross-tenant supplier reputation)
  // belongs in a dedicated, role-gated endpoint — not here.
  const { data } = await supabase
    .from('supplier_network')
    .select('*')
    .eq('company_id', auth.company_id)
    .ilike('supplier_name_normalized', `%${decodeURIComponent(name).toUpperCase()}%`)
    .limit(5)
  return NextResponse.json({ suppliers: data || [] })
}
