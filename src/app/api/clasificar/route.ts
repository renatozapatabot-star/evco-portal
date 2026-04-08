import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET — fetch unreviewed classification decisions
export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  const companyId = session.companyId

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
export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  const companyId = session.companyId

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

  // Writeback resolved fracción to globalpc_productos (closes human feedback loop)
  let writebackResult: { matched: number; updated: number; error: string | null } = {
    matched: 0,
    updated: 0,
    error: null,
  }

  try {
    const { data: decisionRow, error: fetchErr } = await supabase
      .from('agent_decisions')
      .select('id, company_id, payload')
      .eq('id', decision_id)
      .single()

    if (fetchErr || !decisionRow) {
      writebackResult.error = 'Could not fetch decision row: ' + (fetchErr?.message || 'not found')
    } else {
      const payload = decisionRow.payload as Record<string, unknown> | null
      const productDescription = payload?.product_description as string | undefined
      const suggestedFraccion = payload?.suggested_fraccion as string | undefined

      const resolvedFraccion = wasCorrect
        ? suggestedFraccion
        : (corrected_to || suggestedFraccion)

      if (!productDescription) {
        writebackResult.error = 'No product_description in payload'
      } else if (!resolvedFraccion) {
        writebackResult.error = 'No fracción to write'
      } else {
        const { data: matchingRows, error: matchErr } = await supabase
          .from('globalpc_productos')
          .select('id')
          .eq('company_id', decisionRow.company_id)
          .eq('descripcion', productDescription)

        if (matchErr) {
          writebackResult.error = 'Match query failed: ' + matchErr.message
        } else {
          writebackResult.matched = matchingRows?.length || 0

          if (matchingRows && matchingRows.length > 0) {
            const updateIds = matchingRows.map(r => r.id)
            const fraccionSource = wasCorrect ? 'human_tito' : 'human_correction_tito'

            const { error: wbUpdateErr } = await supabase
              .from('globalpc_productos')
              .update({
                fraccion: resolvedFraccion,
                fraccion_source: fraccionSource,
                fraccion_classified_at: new Date().toISOString(),
              })
              .in('id', updateIds)

            if (wbUpdateErr) {
              writebackResult.error = 'Update failed: ' + wbUpdateErr.message
            } else {
              writebackResult.updated = updateIds.length
            }
          }
        }
      }
    }
  } catch (e) {
    writebackResult.error = 'Writeback exception: ' + (e instanceof Error ? e.message : String(e))
  }

  if (writebackResult.error) {
    console.error('[clasificar writeback] ' + writebackResult.error)
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

  return NextResponse.json({ data: { success: true, writeback: writebackResult }, error: null })
}
