export type ThreadStatus = 'open' | 'escalated' | 'resolved'

export type AuthorRole =
  | 'client'
  | 'operator'
  | 'admin'
  | 'broker'
  | 'warehouse'
  | 'contabilidad'
  | 'trafico'
  | 'system'

export interface MensajeriaThread {
  id: string
  company_id: string
  subject: string
  status: ThreadStatus
  trafico_id: string | null
  created_by_role: AuthorRole
  created_by_name: string
  escalated_at: string | null
  escalated_by: string | null
  escalation_summary: string | null
  resolved_at: string | null
  last_message_at: string
  created_at: string
  updated_at: string
}

export interface MensajeriaMessage {
  id: string
  thread_id: string
  company_id: string
  author_role: AuthorRole
  author_name: string
  body: string
  internal_only: boolean
  undo_until: string | null
  undone: boolean
  created_at: string
}

export interface MensajeriaAttachment {
  id: string
  message_id: string
  company_id: string
  file_name: string
  file_path: string
  mime_type: string
  size_bytes: number
  scan_status: 'pending' | 'clean' | 'infected' | 'failed'
  scanned_at: string | null
  created_at: string
}

export interface ThreadWithMeta extends MensajeriaThread {
  unread_count: number
  last_message_preview: string | null
  last_author_role: AuthorRole | null
}

export interface AppError {
  code: string
  message: string
}

export interface Result<T> {
  data: T | null
  error: AppError | null
}
