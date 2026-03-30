import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey, unauthorized } from '@/lib/api-auth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest, { params }: { params: Promise<{ trafico: string }> }) {
  const auth = await authenticateApiKey(request)
  if (!auth) return unauthorized()

  const { trafico } = await params
  const { data } = await supabase.from('crossing_predictions').select('*').eq('trafico_id', trafico).single()
  if (!data) return NextResponse.json({ error: 'No prediction found' }, { status: 404 })
  return NextResponse.json(data)
}
