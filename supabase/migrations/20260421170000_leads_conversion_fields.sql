-- Lead → client conversion fields.
--
-- When a deal closes and we create a real tenant in `companies`, we
-- need to remember which lead produced which tenant. These two
-- columns preserve that provenance link.
--
--   client_code_assigned — the companies.company_id we created for
--                          this lead. NULL until the lead converts.
--   converted_at         — timestamptz of the conversion event.
--
-- No RLS change; existing leads_deny_all policy continues to apply.
-- The conversion endpoint uses the service role.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS client_code_assigned text,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

CREATE INDEX IF NOT EXISTS leads_client_code_assigned_idx
  ON leads(client_code_assigned)
  WHERE client_code_assigned IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_converted_at_idx
  ON leads(converted_at DESC)
  WHERE converted_at IS NOT NULL;

COMMENT ON COLUMN leads.client_code_assigned IS
  'companies.company_id of the tenant created from this lead (NULL until converted).';

COMMENT ON COLUMN leads.converted_at IS
  'Timestamp of lead → client conversion (companies row creation).';
