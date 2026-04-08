import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface LogActionOpts {
  operatorName: string
  actionType: string
  resourceType?: string
  resourceId?: string
  companyId?: string
  metadata?: Record<string, unknown>
}

/**
 * Log an operator action to the operator_actions table.
 * Never throws — silent failure if table doesn't exist yet.
 * This is the shadowing data layer that becomes CRUZ's moat.
 */
export async function logOperatorAction(opts: LogActionOpts): Promise<void> {
  try {
    await supabase.from('operator_actions').insert({
      operator_name: opts.operatorName,
      action_type: opts.actionType,
      resource_type: opts.resourceType || null,
      resource_id: opts.resourceId || null,
      company_id: opts.companyId || null,
      metadata: opts.metadata || {},
    })
  } catch {
    // Silent — table may not exist yet
  }
}

/**
 * Get the operator name from cookies (set on login).
 * Falls back to 'unknown' if not available.
 */
export function getOperatorName(cookies: { get: (name: string) => { value: string } | undefined }): string {
  return cookies.get('operator_name')?.value || 'unknown'
}
