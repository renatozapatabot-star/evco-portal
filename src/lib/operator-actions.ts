import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export type OperatorRole = 'admin' | 'operator' | 'client'

export interface OperatorContext {
  operatorId: string
  authUserId: string
  email: string
  fullName: string
  role: OperatorRole
  companyId: string | null
  active: boolean
}

interface LogActionOpts {
  /** Operator UUID from operators table. If not available, uses operatorName fallback lookup. */
  operatorId?: string
  /** Fallback: operator name for lookup when operatorId not available */
  operatorName?: string
  actionType: string
  targetTable?: string
  targetId?: string
  companyId?: string
  payload?: Record<string, unknown>
  durationMs?: number
  userAgent?: string
}

/**
 * Log an operator action to the operator_actions table.
 * Never throws — silent failure if table doesn't exist or operator not found.
 */
export async function logOperatorAction(opts: LogActionOpts): Promise<void> {
  try {
    let opId = opts.operatorId

    // If no operatorId, try to look up by name
    if (!opId && opts.operatorName) {
      const { data } = await supabase
        .from('operators')
        .select('id')
        .eq('full_name', opts.operatorName)
        .eq('active', true)
        .limit(1)
        .maybeSingle()
      opId = data?.id
    }

    if (!opId) return // Can't log without an operator

    await supabase.from('operator_actions').insert({
      operator_id: opId,
      action_type: opts.actionType,
      target_table: opts.targetTable || null,
      target_id: opts.targetId || null,
      company_id: opts.companyId || null,
      payload: opts.payload || null,
      duration_ms: opts.durationMs || null,
      user_agent: opts.userAgent || null,
    })
  } catch {
    // Silent — never block the request
  }
}

/**
 * Get operator context from the operators table by auth user ID.
 */
export async function getOperatorContext(authUserId: string): Promise<OperatorContext | null> {
  try {
    const { data, error } = await supabase
      .from('operators')
      .select('id, auth_user_id, email, full_name, role, company_id, active')
      .eq('auth_user_id', authUserId)
      .eq('active', true)
      .maybeSingle()

    if (error || !data) return null

    return {
      operatorId: data.id,
      authUserId: data.auth_user_id,
      email: data.email,
      fullName: data.full_name,
      role: data.role as OperatorRole,
      companyId: data.company_id,
      active: data.active,
    }
  } catch {
    return null
  }
}

/**
 * Get the operator name from cookies (set on login).
 * Falls back to 'unknown' if not available.
 */
export function getOperatorName(cookies: { get: (name: string) => { value: string } | undefined }): string {
  return cookies.get('operator_name')?.value || 'unknown'
}

/**
 * Get the operator ID from cookies (set on login).
 */
export function getOperatorId(cookies: { get: (name: string) => { value: string } | undefined }): string | undefined {
  return cookies.get('operator_id')?.value || undefined
}
