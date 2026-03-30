-- BUILD 0: Schema prep for CRUZ Final Build
-- Creates notifications, upgrades documento_solicitudes, creates bridge_times

-- 1. Notifications table (already exists — add missing columns if needed)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS trafico_id TEXT;

-- 2. Upgrade documento_solicitudes with v2 columns
ALTER TABLE documento_solicitudes ADD COLUMN IF NOT EXISTS doc_types TEXT[] DEFAULT '{}';
ALTER TABLE documento_solicitudes ADD COLUMN IF NOT EXISTS recipient_name TEXT DEFAULT '';
ALTER TABLE documento_solicitudes ADD COLUMN IF NOT EXISTS recipient_email TEXT;
ALTER TABLE documento_solicitudes ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE documento_solicitudes ADD COLUMN IF NOT EXISTS channel TEXT[] DEFAULT '{portal}';
ALTER TABLE documento_solicitudes ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
ALTER TABLE documento_solicitudes ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
ALTER TABLE documento_solicitudes ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE documento_solicitudes ADD COLUMN IF NOT EXISTS docs_received TEXT[] DEFAULT '{}';
ALTER TABLE documento_solicitudes ADD COLUMN IF NOT EXISTS created_by UUID;

-- 3. Bridge times table
CREATE TABLE IF NOT EXISTS bridge_times (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bridge_name TEXT NOT NULL,
  bridge_code TEXT NOT NULL,
  wait_minutes INT,
  direction TEXT DEFAULT 'southbound',
  source TEXT DEFAULT 'manual',
  semaforo TEXT CHECK (semaforo IN ('green', 'red', NULL)),
  recorded_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bridge_times_latest
  ON bridge_times(bridge_code, recorded_at DESC);

-- 4. Seed bridge_times with initial data (4 Laredo bridges, no wait data)
INSERT INTO bridge_times (bridge_name, bridge_code, wait_minutes, source, recorded_at)
VALUES
  ('World Trade Bridge', 'WTB', NULL, 'seed', now()),
  ('Colombia Solidarity', 'COL', NULL, 'seed', now()),
  ('Juárez-Lincoln', 'LIN', NULL, 'seed', now()),
  ('Gateway to Americas', 'GAT', NULL, 'seed', now())
ON CONFLICT DO NOTHING;
