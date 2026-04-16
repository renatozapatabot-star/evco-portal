import { createClient } from '@supabase/supabase-js'
import type { PortalRole } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export interface ShadowEntry {
  messageId: string
  userId?: string | null
  operatorId?: string | null
  senderRole: PortalRole
  recipientRole?: PortalRole | null
  topicClass?: string | null
  companyId?: string | null
  toolsCalled?: string[]
  responseTimeMs?: number | null
  escalated?: boolean
  resolved?: boolean
  questionExcerpt?: string
  answerExcerpt?: string
  metadata?: Record<string, unknown>
}

/**
 * Write an CRUZ telemetry row.
 * Silent on failure — never breaks the request. Service-role only; RLS denies
 * every authenticated read by design.
 */
export async function logShadow(entry: ShadowEntry): Promise<void> {
  try {
    await supabase.from('aguila_shadow_log').insert({
      message_id: entry.messageId,
      user_id: entry.userId ?? null,
      operator_id: entry.operatorId ?? null,
      sender_role: entry.senderRole,
      recipient_role: entry.recipientRole ?? null,
      topic_class: entry.topicClass ?? null,
      company_id: entry.companyId ?? null,
      tools_called: entry.toolsCalled ?? [],
      response_time_ms: entry.responseTimeMs ?? null,
      escalated: entry.escalated ?? false,
      resolved: entry.resolved ?? false,
      question_excerpt: entry.questionExcerpt?.slice(0, 500) ?? null,
      answer_excerpt: entry.answerExcerpt?.slice(0, 500) ?? null,
      metadata: entry.metadata ?? {},
    })
  } catch {
    // Silent — telemetry never blocks
  }
}
