-- cost-optimizer · filing-timing heuristic
--
-- `fx_savings_heuristic_pct` is a business-tuned estimate of how much
-- duty savings the broker can realize on a pedimento when timing the
-- payment to a favorable exchange-rate window. Not a regulatory rate —
-- the broker can adjust without a code change.
--
-- Consumer: scripts/cost-optimizer.js :: analyzeFilingTiming()
-- Shape:    { rate: number } where 0 < rate <= 0.05 (0.01% to 5%)
-- Default:  0.008 (0.8%) — the historical baseline from Q1 2026.
--
-- Previously hardcoded as `const fxSavingsPct = 0.008` — violated
-- core-invariants.md rule 17 and was caught by R11 ratchet.
INSERT INTO system_config (key, value, valid_to)
VALUES
  ('fx_savings_heuristic_pct',
   '{"rate": 0.008, "description": "Conservative 0.8% FX opportunity per pedimento — broker-tuned"}',
   '2027-01-01')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      valid_to = EXCLUDED.valid_to;
