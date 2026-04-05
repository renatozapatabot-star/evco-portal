-- Fleet-wide anonymized benchmarks — the data moat
CREATE TABLE IF NOT EXISTS benchmarks (
  id BIGSERIAL PRIMARY KEY,
  metric TEXT NOT NULL,
  dimension TEXT,
  value NUMERIC,
  sample_size INTEGER,
  period TEXT,
  computed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_metric ON benchmarks (metric, dimension);
ALTER TABLE benchmarks ENABLE ROW LEVEL SECURITY;
