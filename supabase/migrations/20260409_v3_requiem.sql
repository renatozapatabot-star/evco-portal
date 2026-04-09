-- CRUZ V3 Requiem Addendum — Database tables
-- Run this in the Supabase SQL Editor to enable CRUZ Remembers + Time Machine

-- 1. Operator Memories (CRUZ Remembers)
CREATE TABLE IF NOT EXISTS operator_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL,
  company_id TEXT,
  memory_type TEXT NOT NULL DEFAULT 'custom_rule',
  trigger_pattern JSONB NOT NULL DEFAULT '{}',
  correction JSONB NOT NULL DEFAULT '{}',
  natural_language_description TEXT NOT NULL,
  applied_count INTEGER DEFAULT 0,
  last_applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_operator_memories_lookup
  ON operator_memories(operator_id, memory_type, active);

-- 2. Cockpit Snapshots (Time Machine)
CREATE TABLE IF NOT EXISTS cockpit_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at TIMESTAMPTZ NOT NULL,
  snapshot_type TEXT NOT NULL DEFAULT 'admin_15min',
  company_id TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cockpit_snapshots_time
  ON cockpit_snapshots(snapshot_type, snapshot_at DESC);

-- 3. Demo leads table (if not exists from Block C)
CREATE TABLE IF NOT EXISTS demo_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  firm_name TEXT NOT NULL,
  patente TEXT,
  aduana TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  source TEXT DEFAULT 'demo_portal',
  status TEXT DEFAULT 'new',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
