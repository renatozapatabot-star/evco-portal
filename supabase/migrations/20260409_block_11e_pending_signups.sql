-- Block 11E: Pending signups table + signup_mode config

-- Signup mode config (system_config already exists — just add the key)
INSERT INTO system_config (key, value, description)
VALUES ('signup_mode', '"gated"'::jsonb, 'Controls signup: "self_service" or "gated" (admin approval)')
ON CONFLICT (key) DO NOTHING;

-- Pending signups table
CREATE TABLE IF NOT EXISTS pending_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  firm_name TEXT NOT NULL,
  firm_slug TEXT NOT NULL,
  patente TEXT NOT NULL,
  aduana TEXT NOT NULL,
  telefono TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES operators(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_signups_status_idx ON pending_signups(status);
CREATE INDEX IF NOT EXISTS pending_signups_email_idx ON pending_signups(email);

ALTER TABLE pending_signups ENABLE ROW LEVEL SECURITY;
