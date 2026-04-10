-- Block B: Add password column for per-operator authentication
ALTER TABLE operators ADD COLUMN IF NOT EXISTS password TEXT;
