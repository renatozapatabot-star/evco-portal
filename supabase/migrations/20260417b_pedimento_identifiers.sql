-- AGUILA · Block 6b — identifiers column for pedimentos.
-- Stores free-form {key: value} pairs (e.g., SAT transaction refs, operator
-- notes) outside the fixed schema. Additive + idempotent.
ALTER TABLE pedimentos
  ADD COLUMN IF NOT EXISTS identifiers jsonb NOT NULL DEFAULT '{}'::jsonb;
