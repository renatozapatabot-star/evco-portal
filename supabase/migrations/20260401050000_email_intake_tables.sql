-- Email intake: inbound email queue + document classifications for PDFs
-- Used by scripts/email-intake.js

CREATE TABLE IF NOT EXISTS email_intake (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL DEFAULT 'evco',
  sender text NOT NULL,
  subject text NOT NULL DEFAULT '',
  received_at timestamptz NOT NULL DEFAULT now(),
  attachment_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  gmail_message_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_intake ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on email_intake"
  ON email_intake FOR ALL
  USING (true)
  WITH CHECK (true);

-- Document classifications linked to inbound emails
ALTER TABLE document_classifications
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'email';

-- Pipeline log: add details jsonb for structured metadata
ALTER TABLE pipeline_log
  ADD COLUMN IF NOT EXISTS details jsonb;
