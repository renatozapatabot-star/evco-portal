-- Block 11C: assign traficos to operators for the operator portal queue
ALTER TABLE traficos
  ADD COLUMN IF NOT EXISTS assigned_to_operator_id UUID REFERENCES operators(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS traficos_assigned_to_operator_id_idx
  ON traficos(assigned_to_operator_id)
  WHERE assigned_to_operator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS traficos_estatus_assigned_idx
  ON traficos(estatus, assigned_to_operator_id);
