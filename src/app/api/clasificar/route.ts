import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET — fetch unreviewed classification decisions
export async function GET() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('company_clave')?.value || 'evco'

  const { data, error } = await supabase
    .from('agent_decisions')
    .select('id, decision, confidence, payload, created_at')
    .eq('trigger_type', 'classification')
    .eq('company_id', companyId)
    .is('was_correct', null)
    .order('confidence', { ascending: true }) // Show lowest confidence first
    .limit(50)

  if (error) {
    return NextResponse.json({ data: null, error: { code: 'QUERY_FAILED', message: error.message } })
  }

  return NextResponse.json({ data: data || [], error: null })
}

// POST — vote on a classification (confirm or correct)
export async function POST(request: Request) {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('company_clave')?.value || 'evco'

  const body = await request.json()
  const { decision_id, action, corrected_to } = body

  if (!decision_id || !action) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_INPUT', message: 'decision_id and action required' } },
      { status: 400 }
    )
  }

  if (!['confirm', 'correct'].includes(action)) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_ACTION', message: 'action must be confirm or correct' } },
      { status: 400 }
    )
  }

  // Update the agent_decision
  const wasCorrect = action === 'confirm'
  const updatePayload: Record<string, unknown> = {
    was_correct: wasCorrect,
    outcome: wasCorrect ? 'confirmed' : 'corrected',
  }
  if (corrected_to) {
    updatePayload.corrected_by = corrected_to
  }

  const { error: updateErr } = await supabase
    .from('agent_decisions')
    .update(updatePayload)
    .eq('id', decision_id)
    .eq('company_id', companyId)

  if (updateErr) {
    return NextResponse.json(
      { data: null, error: { code: 'UPDATE_FAILED', message: updateErr.message } },
      { status: 500 }
    )
  }

  // Update autonomy_config counters
  const { data: config } = await supabase
    .from('autonomy_config')
    .select('consecutive_correct, errors_7d, accuracy_30d')
    .eq('action_type', 'classification')
    .maybeSingle()

  if (config) {
    if (wasCorrect) {
      await supabase
        .from('autonomy_config')
        .update({
          consecutive_correct: (config.consecutive_correct || 0) + 1,
        })
        .eq('action_type', 'classification')
    } else {
      await supabase
        .from('autonomy_config')
        .update({
          consecutive_correct: 0,
          errors_7d: (config.errors_7d || 0) + 1,
        })
        .eq('action_type', 'classification')
    }
  }

  return NextResponse.json({ data: { success: true }, error: null })
}
