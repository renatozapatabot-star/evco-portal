-- Aggregate crossing analytics: avg crossing time by day-of-week
-- Used by scripts/crossing-predictor.js (every 6 hours)
-- Separate from crossing_predictions (per-trafico predictions by crossing-prediction.js)

CREATE TABLE IF NOT EXISTS crossing_windows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  avg_crossing_days NUMERIC(6,2) NOT NULL,
  sample_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, day_of_week)
);

ALTER TABLE crossing_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on crossing_windows"
  ON crossing_windows
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users read own company crossing_windows"
  ON crossing_windows
  FOR SELECT
  USING (company_id = current_setting('request.jwt.claims', true)::json->>'company_id');

COMMENT ON TABLE crossing_windows IS 'Aggregate crossing time by day-of-week. Updated every 6h by crossing-predictor.js.';
