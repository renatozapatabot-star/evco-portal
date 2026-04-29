-- Backfill MXP → MXN on 39,895 historical rows across 6 GlobalPC-sourced tables.
--
-- MXP is the deprecated peso ISO 4217 code, retired in the 1993 Mexican peso
-- redenomination. Every fecha on the affected rows is 2014 or later — 21+ years
-- after redenomination, so MXP labeling is structurally wrong on every row.
-- MXP and MXN refer to the same monetary unit; the conversion is mathematically
-- lossless (no value scaling needed, just label correction).
--
-- Investigation: ~/Desktop/moneda-investigation-2026-04-29.md
--
-- Writer fix
-- ----------
-- The companion commit (PART 1 of this branch) added a `normalizeMoneda(m)`
-- helper to scripts/globalpc-sync.js and applied it to all 6 mapRow blocks
-- so that future syncs translate MXP → MXN at the boundary. Without that
-- writer fix, every nightly globalpc-sync run would re-introduce MXP from
-- GlobalPC's stale MySQL source.
--
-- Pre-state (verified 2026-04-29 14:46 CT)
-- ----------------------------------------
--   globalpc_facturas       MXP =    155
--   econta_facturas         MXP =  6,518
--   econta_cartera          MXP = 14,349
--   econta_ingresos         MXP =  3,473
--   econta_egresos          MXP =  7,149
--   econta_anticipos        MXP =  8,251
--                                 ──────
--                          TOTAL = 39,895
--
-- Post-state target
-- -----------------
--   All 6 tables: 0 rows with moneda='MXP'.
--   Other moneda values (USD/MXN/EUR/CAD/JPY/etc.) untouched.
--   Row counts per table unchanged (only the column flips on affected rows).
--
-- Application path
-- ----------------
-- `supabase db push --linked` is still blocked on the unrelated local-vs-remote
-- migration history mismatch from earlier branches. Applied directly via the
-- service-role JS client using PostgREST's native UPDATE...WHERE pattern:
--
--   await sb.from(t).update({ moneda: 'MXN' }).eq('moneda', 'MXP').select(...)
--
-- This is equivalent to the SQL below; the .sql file is the canonical record.

UPDATE globalpc_facturas SET moneda = 'MXN' WHERE moneda = 'MXP';   -- 155 rows
UPDATE econta_facturas    SET moneda = 'MXN' WHERE moneda = 'MXP';  -- 6,518 rows
UPDATE econta_cartera     SET moneda = 'MXN' WHERE moneda = 'MXP';  -- 14,349 rows
UPDATE econta_ingresos    SET moneda = 'MXN' WHERE moneda = 'MXP';  -- 3,473 rows
UPDATE econta_egresos     SET moneda = 'MXN' WHERE moneda = 'MXP';  -- 7,149 rows
UPDATE econta_anticipos   SET moneda = 'MXN' WHERE moneda = 'MXP';  -- 8,251 rows

-- Verification queries (run after applying)
-- -----------------------------------------
--   SELECT 'globalpc_facturas' AS t, COUNT(*) FILTER (WHERE moneda='MXP') AS mxp FROM globalpc_facturas
--   UNION ALL SELECT 'econta_facturas',  COUNT(*) FILTER (WHERE moneda='MXP') FROM econta_facturas
--   UNION ALL SELECT 'econta_cartera',   COUNT(*) FILTER (WHERE moneda='MXP') FROM econta_cartera
--   UNION ALL SELECT 'econta_ingresos',  COUNT(*) FILTER (WHERE moneda='MXP') FROM econta_ingresos
--   UNION ALL SELECT 'econta_egresos',   COUNT(*) FILTER (WHERE moneda='MXP') FROM econta_egresos
--   UNION ALL SELECT 'econta_anticipos', COUNT(*) FILTER (WHERE moneda='MXP') FROM econta_anticipos;
--   -- Expected: 0 across every row.
--
-- Followup (NOT in scope of this migration)
-- -----------------------------------------
-- Two more MXP rows live on aduanet_facturas (2 rows) and one on coves
-- (1 row). They come from a different writer (the new restored aduanet
-- scraper extracting C005MONFAC from at005 SAT XML), not globalpc-sync.
-- The SAT C005MONFAC field typically returns USD/MXN/EUR (never MXP), so
-- those 3 rows are likely vestigial from an older import path. Out of
-- scope for this branch; addressable in a separate ~5-min UPDATE if needed.
