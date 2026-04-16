-- Client morning briefings — daily 3-sentence Spanish summary generated
-- by Sonnet at 7 AM Mon-Fri for each active client, rendered at the
-- top of /inicio above the hero KPIs.
--
-- Apply via Supabase SQL editor (db push is known-broken in this repo).

CREATE TABLE IF NOT EXISTS client_briefings (
  id                uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id        text          NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  generated_at      timestamptz   NOT NULL DEFAULT NOW(),
  period_start      date          NOT NULL,
  period_end        date          NOT NULL,
  briefing_text     text          NOT NULL,
  data_points       jsonb,
  action_item       text,
  action_url        text,
  seen_at           timestamptz,
  dismissed_at      timestamptz
);

CREATE INDEX IF NOT EXISTS client_briefings_company_generated_idx
  ON client_briefings (company_id, generated_at DESC);

ALTER TABLE client_briefings ENABLE ROW LEVEL SECURITY;

-- Client RLS: each company's users can only see their own briefings.
-- Service-role (used by the generator cron) bypasses RLS as always.
DROP POLICY IF EXISTS client_sees_own_briefings ON client_briefings;
CREATE POLICY client_sees_own_briefings ON client_briefings
  FOR SELECT
  USING (
    company_id = current_setting('request.jwt.claims', true)::json->>'company_id'
  );

-- Clients may update their own briefings to record seen/dismissed state.
DROP POLICY IF EXISTS client_updates_own_briefings ON client_briefings;
CREATE POLICY client_updates_own_briefings ON client_briefings
  FOR UPDATE
  USING (
    company_id = current_setting('request.jwt.claims', true)::json->>'company_id'
  )
  WITH CHECK (
    company_id = current_setting('request.jwt.claims', true)::json->>'company_id'
  );
