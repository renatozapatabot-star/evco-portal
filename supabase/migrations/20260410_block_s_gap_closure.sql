-- Block S: Gap Closure Sprint — 5 major workflow features
-- Run in Supabase SQL Editor to activate all 5 gaps

-- 1. Notification system
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID,
  recipient_role TEXT DEFAULT 'client',
  company_id TEXT,
  event_type TEXT NOT NULL,
  subject_type TEXT,
  subject_id TEXT,
  title_es TEXT NOT NULL,
  body_es TEXT NOT NULL,
  action_url TEXT,
  channel TEXT NOT NULL DEFAULT 'in_app',
  sent_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, created_at DESC);

-- 2. Shift handoffs
CREATE TABLE IF NOT EXISTS shift_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outgoing_operator_id UUID NOT NULL,
  incoming_operator_id UUID,
  pending_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  urgent_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes_es TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Client issues
CREATE TABLE IF NOT EXISTS client_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  reported_by TEXT,
  trafico_id TEXT,
  category TEXT NOT NULL DEFAULT 'otro',
  severity TEXT NOT NULL DEFAULT 'media',
  title_es TEXT NOT NULL,
  description_es TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'abierto',
  assigned_to UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution_notes_es TEXT
);

CREATE INDEX IF NOT EXISTS idx_client_issues_open ON client_issues(status, created_at DESC);

-- 4. Transportista directory
CREATE TABLE IF NOT EXISTS transportistas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  whatsapp_number TEXT,
  email TEXT,
  reliability_score NUMERIC(3,2) DEFAULT 0.80,
  active BOOLEAN DEFAULT TRUE,
  notes_es TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Carrier assignments
CREATE TABLE IF NOT EXISTS trafico_carrier_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trafico_id TEXT NOT NULL,
  transportista_id UUID NOT NULL,
  assigned_by UUID,
  status TEXT NOT NULL DEFAULT 'asignado',
  pickup_scheduled_at TIMESTAMPTZ,
  delivery_scheduled_at TIMESTAMPTZ,
  notes_es TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
