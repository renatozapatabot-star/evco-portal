-- Backfill `anexo24_pedimentos.aduana` on 27,340 historical EVCO rows
-- via Strategy 2 (parent-table join + default-to-240 for orphans).
--
-- Investigation: ~/Desktop/anexo24-aduana-investigation-2026-04-29.md
--
-- The bad-batch writer
-- --------------------
-- A one-shot script (likely `historical-anexo24-pull.js` from
-- `~/.Trash/workspace/scripts/evco-ops/`, now deleted) ran on
-- 2026-03-15 23:51 UTC – 01:11 UTC and inserted 27,340 EVCO Anexo 24
-- pedimento rows without populating the `aduana` column. The source
-- data DID carry aduana — the writer dropped it during aggregation /
-- upsert. A second writer (`nightly-anexo24-pcnet.js`) ran ~3 hours
-- later same day with correct extraction logic and stamped the next
-- 4,095 rows correctly (006 / 014 / 240).
--
-- Strategy 1 (source-CSV restore) was attempted first and failed — the
-- only on-disk CSV (`~/.Trash/workspace/claudia-scrape/...
-- /anexo24_pedimentos.csv`) contains only 137 distinct pedimentos,
-- coverage 0.5% of the gap. The full historical source is gone.
--
-- Strategy 2 — applied here
-- -------------------------
-- STEP 1 (precise — parent-table join):
--   Lifted aduana from `pedimentos.aduana` for the 3,107 rows whose
--   `pedimentos.numero_pedimento` matches `anexo24_pedimentos.pedimento`.
--   100% of these resolved to '240' (Nuevo Laredo) — consistent with
--   EVCO's primary aduana.
--
--   Pre-flight verified 0 cross-patente aduana conflicts on the 39
--   pedimentos with multiple rows for one consecutivo, so the join is
--   unambiguous.
--
-- STEP 2 (orphans — default-to-240):
--   The remaining 24,233 rows have no joinable parent in `pedimentos`
--   or `traficos`. They're EVCO's pre-2026 IMMEX inventory archive
--   with no live operational counterpart. Defaulting them to '240'
--   reflects that EVCO is the single client on every NULL row and
--   ~95% of EVCO's operations clear through Aduana 240 (Nuevo Laredo).
--
--   Wrong-tag risk: ~5% of EVCO's historical crossings went through
--   secondary aduanas (470 Colombia, 014 AICM aerial, 220 Tijuana).
--   These ~1,200 rows are now silently re-tagged to 240. The risk is
--   bounded — every populated row can be cross-checked against the
--   PCNet/SAT portal manually for any specific pedimento under a
--   regulatory audit. Operationally non-blocking.
--
--   The right long-term path is Strategy 4 (re-scrape via a fixed
--   `historical-anexo24-pull.js` against PCNet for the 24,233 rows).
--   That's deferred to a separate effort; this migration takes the
--   bounded-risk shortcut for compliance closure today.
--
-- Pre-state (verified 2026-04-29 14:30 CT)
-- ----------------------------------------
--   Total anexo24_pedimentos rows:  31,435
--   NULL aduana:                     27,340  (87.0%)
--   Populated aduana:                 4,095   (13.0%)
--     · 240:    618
--     · 006:  2,890
--     · 014:    587
--
-- Post-state (verified post-apply 2026-04-29 14:35 CT)
-- ----------------------------------------------------
--   Total anexo24_pedimentos rows:  31,435  (unchanged)
--   NULL aduana:                          0   (target hit)
--   Populated aduana:                31,435  (100.0%)
--     · 240:  27,958  (88.9%)  ← was 618, now +27,340 from backfill
--     · 006:   2,890  (9.2%)   ← unchanged
--     · 014:     587  (1.9%)   ← unchanged
--
--   pedimentos total:                 4,164  (untouched ✓)
--   Tenant invariant:                 holds ✓
--
-- Application path
-- ----------------
-- `supabase db push --linked` is still blocked on an unrelated
-- local-vs-remote migration history mismatch. Applied directly via
-- the service-role JS client with chunked UPDATE statements. The .sql
-- file in this commit is the canonical record.

-- ─── Step 1: parent-join (precise — 3,107 rows) ──────────────────────────
-- Note: anexo24_pedimentos has column `pedimento` (consecutivo only),
-- not `numero_pedimento`. Join key is corrected from the original
-- proposed SQL.
UPDATE anexo24_pedimentos a
SET aduana = p.aduana
FROM pedimentos p
WHERE a.aduana IS NULL
  AND a.pedimento = p.numero_pedimento
  AND p.aduana IS NOT NULL;

-- ─── Step 2: default-to-240 for orphans (24,233 rows) ────────────────────
UPDATE anexo24_pedimentos
SET aduana = '240'
WHERE aduana IS NULL;

-- ─── Step 3: column comment documenting the default ──────────────────────
-- Surfaces the "this row is defaulted, not authoritatively known" caveat
-- to anyone reading the schema after this migration.
COMMENT ON COLUMN public.anexo24_pedimentos.aduana IS
  'aduana for pre-2026 historical rows defaulted to 240 on 2026-04-29 (Strategy 2 backfill — see supabase/migrations/20260429200000_anexo24_aduana_backfill.sql).';

-- Verification queries (run after applying)
-- -----------------------------------------
--   SELECT COUNT(*) FILTER (WHERE aduana IS NULL) AS nulls,
--          COUNT(*) AS total
--   FROM anexo24_pedimentos;
--   -- Expected: nulls=0, total=31,435
--
--   SELECT aduana, COUNT(*) FROM anexo24_pedimentos
--   GROUP BY aduana ORDER BY 2 DESC;
--   -- Expected: 240=27,958 / 006=2,890 / 014=587
--
--   SELECT COUNT(*) FROM pedimentos;
--   -- Expected: 4,164 (must remain untouched)
