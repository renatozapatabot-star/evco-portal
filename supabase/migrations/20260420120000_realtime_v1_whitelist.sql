-- ============================================================================
-- V1 READINESS — Realtime publication whitelist + tenant NULL cleanup
-- ============================================================================
-- Problem:  supabase_realtime currently has ~224 tables. Only ~10 are
--           actually subscribed in application code. Every unsubscribed
--           table wastes WAL bandwidth + realtime server memory and
--           makes every row mutation fan out unnecessarily.
--
-- Approach: (1) codify the exact tables that V1 needs in realtime,
--           (2) drop everything else via a DO block that introspects
--               the current publication membership — idempotent and
--               adapts to whatever 224 tables are actually there,
--           (3) (re-)add the whitelist defensively so this migration
--               converges the publication to the target set regardless
--               of prior state.
--
-- Whitelist source of truth: grep -rE "postgres_changes|\.channel\("
--                            src/ yielded these 10 tables, verified
--                            2026-04-20.
-- ============================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- Phase 1 · Drop every table from supabase_realtime except the whitelist.
-- -------------------------------------------------------------------------
DO $$
DECLARE
  v_keep text[] := ARRAY[
    -- Client-facing (Ursula + Tier 1 client cockpits read these live):
    'traficos',               -- /inicio, /traficos, /embarques, /entradas (joined), /monitor
    'entradas',               -- /entradas, /embarques (joined)
    'expediente_documentos',  -- /expedientes, /embarques/[id]
    'notifications',          -- header NotificationBell (every authenticated page)
    -- Admin / operator cockpits (broker side):
    'workflow_events',        -- /admin/inicio, /corredor, /operador/cola
    'pedimento_drafts',       -- /admin/_components/AdminCockpit
    'operational_decisions',  -- /admin/inicio
    'operator_actions',       -- use-cockpit-realtime
    -- Messaging (both sides):
    'mensajeria_messages',    -- /mensajeria
    'whatsapp_conversations'  -- /mensajes
  ];
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename <> ALL (v_keep)
  LOOP
    EXECUTE format(
      'ALTER PUBLICATION supabase_realtime DROP TABLE %I.%I',
      r.schemaname, r.tablename
    );
    RAISE NOTICE 'Dropped % from supabase_realtime', r.tablename;
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- Phase 2 · Defensively ADD the 10 whitelist tables (no-op if present).
-- -------------------------------------------------------------------------
DO $$
DECLARE
  v_add text[] := ARRAY[
    'traficos','entradas','expediente_documentos','notifications',
    'workflow_events','pedimento_drafts','operational_decisions',
    'operator_actions','mensajeria_messages','whatsapp_conversations'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY v_add
  LOOP
    -- Only add if both the table exists AND it isn't already in the pub.
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t)
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
       )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Added % to supabase_realtime', t;
    END IF;
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- Phase 3 · Tenant NULL cleanup (found by scripts/_v1-tenant-null-audit.js
--          on 2026-04-20):
--
--          pedimento_drafts    1 / 2,185    (0.05%)  — orphan stale draft
--          agent_decisions     207 / 4,465  (4.64%)  — legacy cron rows
--          operator_actions    2,117 / 2,347 (90.20%) — pre-session-fix rows
--
-- Strategy: these are ALL historical rows from before the Block EE
--          company_id contract was enforced. None are actively queried
--          by client surfaces. We mark them with a sentinel 'legacy-null'
--          company_id so future queries can safely filter them out AND
--          future writes MUST set a real company_id (enforced by the
--          NOT NULL constraint added at the end).
-- -------------------------------------------------------------------------

-- One stale email-intake draft from 2026-03-30. Safe to archive — it
-- never got approved and the trafico_id is a placeholder ('pending-*').
UPDATE public.pedimento_drafts
  SET company_id = 'legacy-null',
      status     = COALESCE(status, 'draft'),
      updated_at = now()
  WHERE company_id IS NULL;

-- Classifier cron writes with no tenant scope — these predate the
-- Block EE patch. Safe to stamp legacy-null; /inicio/[client] queries
-- filter by the client's real company_id and will never surface these.
UPDATE public.agent_decisions
  SET company_id = 'legacy-null'
  WHERE company_id IS NULL;

-- Operator telemetry pre-dating the session-fix. These are audit
-- breadcrumbs (view_cockpit etc.), NOT tenant data. Legacy-null is
-- the correct tag.
UPDATE public.operator_actions
  SET company_id = 'legacy-null'
  WHERE company_id IS NULL;

-- -------------------------------------------------------------------------
-- Phase 4 · Lock the door. company_id becomes NOT NULL on the three
--          leaky tables so future writers cannot regress.
--
--          (Per tenant-isolation.md: "Every write to a tenant-scoped
--           table MUST include company_id.")
-- -------------------------------------------------------------------------
ALTER TABLE public.pedimento_drafts    ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.agent_decisions     ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.operator_actions    ALTER COLUMN company_id SET NOT NULL;

COMMIT;

-- Verification (run AFTER the migration, outside the transaction):
-- SELECT tablename FROM pg_publication_tables
--   WHERE pubname='supabase_realtime' AND schemaname='public'
--   ORDER BY tablename;
-- SELECT 'pedimento_drafts' AS t, COUNT(*) FILTER (WHERE company_id IS NULL) FROM public.pedimento_drafts
-- UNION ALL
-- SELECT 'agent_decisions', COUNT(*) FILTER (WHERE company_id IS NULL) FROM public.agent_decisions
-- UNION ALL
-- SELECT 'operator_actions', COUNT(*) FILTER (WHERE company_id IS NULL) FROM public.operator_actions;
