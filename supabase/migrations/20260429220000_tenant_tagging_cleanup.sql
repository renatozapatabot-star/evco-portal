-- Tenant-tagging cleanup — remap clave-shape company_id values to the
-- slug across notifications, expediente_documentos, operational_decisions.
--
-- Source: ~/Desktop/audit-data-quality-2026-04-29.md
--   Critical findings #1, #2, #4
-- Companion writer-fix commit (PART 1): 0364251 on this branch.
-- Pre-flight log:
--   ~/evco-portal/scripts/_audit-tmp/data-quality-2026-04-29/pre-flight-2.log
--
-- The 2026-04-29 audit found that 187 distinct 4-digit clave codes had
-- silently accumulated in `notifications.company_id` (60K rows), 178 in
-- `expediente_documentos.company_id` (~72K affected rows after the
-- authorized 6,397-row system_boost junk delete), and 3 in
-- `operational_decisions.company_id`. Cause was the same as the
-- aduanet-import bug closed by 2026-04-23 commit b4ea3df: writers in
-- these paths were stamping `company_id` from raw `clave_cliente`
-- rather than resolving through the `companies` allowlist. Concrete
-- impact: the standard portal filter `.eq('company_id',
-- session.companyId)` (where `session.companyId` is the slug) silently
-- misses ~99% of these rows.
--
-- Pre-flight verification (run 2026-04-29 19:51 CT after the
-- authorized junk-delete + sentinel-insert):
--   notifications:          60065 rows, 187 claves, 28978 resolvable, 0 unresolved
--   expediente_documentos: 301605 rows, 178 claves, 72033 resolvable, 0 unresolved
--   operational_decisions: 173701 rows,   3 claves,   346 resolvable, 0 unresolved
--                                       386 NULL (intentional system-level rows — preserved)
--   ✅ PRE-FLIGHT PASSED — all clave-shape values resolve to a slug.
--
-- Pre-flight remediation (executed 2026-04-29 19:51 CT, authorized by
-- Renato IV before this migration):
--   1. DELETE FROM expediente_documentos
--      WHERE company_id='1' AND uploaded_by IN ('system_boost','boost_100');
--      → 6,397 rows removed (all from a 2026-03-15 02:37–02:39 boost run
--        with synthetic pedimento_id values; not tied to any real trafico).
--   2. INSERT 2 sentinel companies for unresolved real-looking claves:
--        ('orphan-2420', '2420', 'ORPHAN-2420 (Patente 3596 partner — not onboarded)', false)
--        ('orphan-5178', '5178', 'ORPHAN-5178 (likely different patente — investigate)', false)
--      → 32 rows newly resolvable through these sentinels.
--
-- The companies allowlist preference order matches PART 1's
-- `buildClaveMap`: ACTIVE companies win on conflict; inactive Block-EE
-- legacy slugs are used only as a last resort if no active sibling
-- claims the same clave_cliente. This migration uses the same logic
-- via `MAX(c.active::int)` ordering to keep the two paths in agreement.
--
-- Idempotent: safe to re-run. After the first successful pass the
-- WHERE clause `company_id ~ '^[0-9]{1,4}$'` matches zero rows.
-- Row counts are preserved (no DELETEs in this migration).
--
-- Tables not touched here:
--   - oca_database         (3 distinct claves, 345 rows — separate
--                            follow-up branch fix/oca-tenant-cleanup)
--   - globalpc_eventos     (133 distinct claves, ~133K rows — owned
--                            by parallel session globalpc-sync.js)

BEGIN;

-- ─── notifications ─────────────────────────────────────────────────────
-- Pre-state: 187 distinct clave-shape values across 28,978 rows.
-- Post-state target: 0 clave-shape rows.
WITH allowlist AS (
  -- Build the clave → slug map. ACTIVE companies win on conflict via
  -- DISTINCT ON ordering — same precedence as scripts/lib/tenant-tags.js
  -- and src/lib/tenant/resolve-slug.ts.
  SELECT DISTINCT ON (clave) clave, company_id AS slug
  FROM (
    SELECT clave_cliente AS clave, company_id, active FROM companies WHERE clave_cliente IS NOT NULL
    UNION ALL
    SELECT globalpc_clave AS clave, company_id, active FROM companies WHERE globalpc_clave IS NOT NULL
  ) src
  ORDER BY clave, active DESC NULLS LAST, company_id
)
UPDATE notifications n
SET    company_id = a.slug
FROM   allowlist a
WHERE  n.company_id = a.clave
  AND  n.company_id ~ '^[0-9]{1,4}$';

-- ─── expediente_documentos ────────────────────────────────────────────
-- Pre-state: 178 distinct clave-shape values across 72,033 rows.
-- (Reduced from 179/72,007 by the pre-flight orphan-2420/5178 sentinels;
--  the authorized 6,397-row system_boost delete removed company_id='1'
--  which was a true-junk value, not a real clave.)
WITH allowlist AS (
  SELECT DISTINCT ON (clave) clave, company_id AS slug
  FROM (
    SELECT clave_cliente AS clave, company_id, active FROM companies WHERE clave_cliente IS NOT NULL
    UNION ALL
    SELECT globalpc_clave AS clave, company_id, active FROM companies WHERE globalpc_clave IS NOT NULL
  ) src
  ORDER BY clave, active DESC NULLS LAST, company_id
)
UPDATE expediente_documentos e
SET    company_id = a.slug
FROM   allowlist a
WHERE  e.company_id = a.clave
  AND  e.company_id ~ '^[0-9]{1,4}$';

-- ─── operational_decisions ────────────────────────────────────────────
-- Pre-state: 3 distinct clave-shape values across 346 rows + 386 NULL.
-- Post-state target: 0 clave-shape rows. The 386 NULL rows are
-- intentional system-level decisions and stay NULL — see the PART 1
-- decision-logger.ts contract.
WITH allowlist AS (
  SELECT DISTINCT ON (clave) clave, company_id AS slug
  FROM (
    SELECT clave_cliente AS clave, company_id, active FROM companies WHERE clave_cliente IS NOT NULL
    UNION ALL
    SELECT globalpc_clave AS clave, company_id, active FROM companies WHERE globalpc_clave IS NOT NULL
  ) src
  ORDER BY clave, active DESC NULLS LAST, company_id
)
UPDATE operational_decisions o
SET    company_id = a.slug
FROM   allowlist a
WHERE  o.company_id = a.clave
  AND  o.company_id ~ '^[0-9]{1,4}$';

COMMIT;

-- Post-migration verification (run after `supabase db push` or equivalent):
--
-- SELECT 'notifications'           AS t, COUNT(*) AS clave_rows FROM notifications          WHERE company_id ~ '^[0-9]{1,4}$'
-- UNION ALL
-- SELECT 'expediente_documentos'   AS t, COUNT(*) AS clave_rows FROM expediente_documentos  WHERE company_id ~ '^[0-9]{1,4}$'
-- UNION ALL
-- SELECT 'operational_decisions'   AS t, COUNT(*) AS clave_rows FROM operational_decisions  WHERE company_id ~ '^[0-9]{1,4}$';
--
-- Expected: all three counts = 0.
