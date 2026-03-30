-- MVE penalty amounts per SAT regulation
-- Used by SavingsWidget and CRUZ AI compliance tools
INSERT INTO system_config (key, value, valid_to)
VALUES
  ('mve_penalty_min', '{"amount": 4790, "currency": "MXN", "per": "operacion"}', '2027-01-01'),
  ('mve_penalty_max', '{"amount": 7190, "currency": "MXN", "per": "operacion"}', '2027-01-01')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, valid_to = EXCLUDED.valid_to;
