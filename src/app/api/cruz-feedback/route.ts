import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { sessionId, helpful } = await req.json()
    const { error } = await supabase.from('cruz_conversations')
      .update({ was_helpful: helpful })
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) console.error('Feedback save error:', error)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
