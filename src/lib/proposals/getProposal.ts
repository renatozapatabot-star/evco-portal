import { createClient } from '@supabase/supabase-js'

// P0-A4: explicit service-role requirement. proposals reads tenant
// data; callers gate by session companyId.
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY required for src/lib/proposals/getProposal.ts')
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SERVICE_ROLE,
)

export interface SurfaceProposal {
  id: string
  subject_type: string
  subject_id: string
  company_id: string | null
  proposal_action: string
  proposal_action_payload: Record<string, unknown>
  proposal_label_es: string
  reasoning_bullets: Array<{ text: string }>
  confidence: number
  confidence_source: string
  alternatives: Array<{ action: string; label_es: string; confidence: number }>
  generated_at: string
  expires_at: string
}

/**
 * Get the active proposal for a specific subject.
 * Returns null if no proposal exists, table doesn't exist, or confidence < 0.5.
 */
export async function getProposal(subjectType: string, subjectId: string): Promise<SurfaceProposal | null> {
  try {
    const { data, error } = await sb
      .from('surface_proposals')
      .select('*')
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId)
      .eq('active', true)
      .gte('confidence', 0.5)
      .maybeSingle()

    if (error) return null // Table may not exist yet
    return data as SurfaceProposal | null
  } catch {
    return null
  }
}

/**
 * Get proposals for multiple subjects in one query.
 * Returns a Map keyed by subject_id.
 */
export async function getProposalsBatch(
  subjectType: string,
  subjectIds: string[],
): Promise<Map<string, SurfaceProposal>> {
  const map = new Map<string, SurfaceProposal>()
  if (subjectIds.length === 0) return map

  try {
    const { data, error } = await sb
      .from('surface_proposals')
      .select('*')
      .eq('subject_type', subjectType)
      .in('subject_id', subjectIds)
      .eq('active', true)
      .gte('confidence', 0.5)

    if (error || !data) return map

    for (const p of data) {
      map.set(p.subject_id, p as SurfaceProposal)
    }
  } catch {
    // Table may not exist yet
  }

  return map
}
