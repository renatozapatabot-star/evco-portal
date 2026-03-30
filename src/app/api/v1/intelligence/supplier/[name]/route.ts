import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey, unauthorized } from '@/lib/api-auth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const auth = await authenticateApiKey(request)
  if (!auth) return unauthorized()

  const { name } = await params
  const { data } = await supabase.from('supplier_network')
    .select('*').ilike('supplier_name_normalized', `%${decodeURIComponent(name).toUpperCase()}%`).limit(5)
  return NextResponse.json({ suppliers: data || [] })
}
