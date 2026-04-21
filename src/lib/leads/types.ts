/**
 * Leads CRM types — shared between the API route and the admin UI.
 */

export type LeadStage =
  | 'new'
  | 'contacted'
  | 'demo-booked'
  | 'demo-viewed'
  | 'negotiating'
  | 'won'
  | 'lost'
  | 'nurture'

export type LeadSource =
  | 'cold-email'
  | 'linkedin'
  | 'referral'
  | 'demo'
  | 'inbound'
  | 'other'

export type LeadPriority = 'high' | 'normal' | 'low'

export const LEAD_STAGES: readonly LeadStage[] = [
  'new',
  'contacted',
  'demo-booked',
  'demo-viewed',
  'negotiating',
  'won',
  'lost',
  'nurture',
] as const

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  'new': 'Nuevo',
  'contacted': 'Contactado',
  'demo-booked': 'Demo agendado',
  'demo-viewed': 'Demo visto',
  'negotiating': 'Negociando',
  'won': 'Ganado',
  'lost': 'Perdido',
  'nurture': 'Nurture',
}

export const LEAD_SOURCES: readonly LeadSource[] = [
  'cold-email',
  'linkedin',
  'referral',
  'demo',
  'inbound',
  'other',
] as const

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  'cold-email': 'Cold email',
  'linkedin': 'LinkedIn',
  'referral': 'Referido',
  'demo': 'Demo público',
  'inbound': 'Inbound',
  'other': 'Otro',
}

export interface LeadRow {
  id: string
  firm_name: string
  contact_name: string | null
  contact_title: string | null
  contact_email: string | null
  contact_phone: string | null
  rfc: string | null
  source: LeadSource
  source_campaign: string | null
  source_url: string | null
  stage: LeadStage
  stage_changed_at: string | null
  priority: LeadPriority
  value_monthly_mxn: number | null
  last_contact_at: string | null
  next_action_at: string | null
  next_action_note: string | null
  industry: string | null
  aduana: string | null
  volume_note: string | null
  notes: string | null
  owner_user_id: string | null
  created_at: string
  updated_at: string
}

// ── Lead activities (timeline) ──────────────────────────────────────

export type LeadActivityKind =
  | 'stage_change'
  | 'field_update'
  | 'note'
  | 'call'
  | 'email_sent'
  | 'email_received'
  | 'meeting'
  | 'demo_sent'
  | 'system'

export const LEAD_ACTIVITY_KINDS: readonly LeadActivityKind[] = [
  'stage_change',
  'field_update',
  'note',
  'call',
  'email_sent',
  'email_received',
  'meeting',
  'demo_sent',
  'system',
] as const

export const LEAD_ACTIVITY_KIND_LABELS: Record<LeadActivityKind, string> = {
  'stage_change': 'Cambio de etapa',
  'field_update': 'Edición',
  'note': 'Nota',
  'call': 'Llamada',
  'email_sent': 'Email enviado',
  'email_received': 'Email recibido',
  'meeting': 'Reunión',
  'demo_sent': 'Demo compartido',
  'system': 'Sistema',
}

/** Kinds a user can log manually (others are system-generated). */
export const MANUAL_ACTIVITY_KINDS: readonly LeadActivityKind[] = [
  'note',
  'call',
  'email_sent',
  'email_received',
  'meeting',
  'demo_sent',
] as const

export interface LeadActivityRow {
  id: string
  lead_id: string
  kind: LeadActivityKind
  summary: string
  metadata: Record<string, unknown> | null
  actor_user_id: string | null
  actor_name: string | null
  occurred_at: string
  created_at: string
}
