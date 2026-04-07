-- CRUZ Supplier Network Scores — cross-client anonymized rankings
-- Aggregated daily from supplier_profiles + traficos across all companies.
-- No company_id exposed — purely network-level intelligence.

CREATE TABLE IF NOT EXISTS supplier_network_scores (
  id BIGSERIAL PRIMARY KEY,
  supplier_name TEXT NOT NULL UNIQUE,
  clients_served INTEGER DEFAULT 0,
  total_operations INTEGER DEFAULT 0,
  avg_doc_turnaround_days NUMERIC(6,2),
  compliance_rate NUMERIC(5,2),
  tmec_qualification_rate NUMERIC(5,2),
  reliability_score NUMERIC(5,2),
  trend TEXT DEFAULT 'stable',
  rank_in_network INTEGER,
  computed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_supplier_network_rank ON supplier_network_scores(rank_in_network);
CREATE INDEX idx_supplier_network_score ON supplier_network_scores(reliability_score DESC);

ALTER TABLE supplier_network_scores ENABLE ROW LEVEL SECURITY;

-- Public read: anonymized data, no company_id column
CREATE POLICY "anyone_can_read_supplier_network" ON supplier_network_scores
  FOR SELECT USING (true);

-- Service role write only
CREATE POLICY "service_write_supplier_network" ON supplier_network_scores
  FOR ALL USING (current_setting('role', true) = 'service_role');
