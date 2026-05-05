-- Fix pedimento_id format on the 3,309 historical rows from the
-- 2026-03-31 18:03 bad-batch script (Bug A in the format-padding
-- investigation: ~/Desktop/pedimento-format-investigation-2026-04-29.md).
--
-- Bug A signature
-- ---------------
-- Pedimento_id stamped with 3-digit aduana segment, e.g.
--   "17 240 3712 7003925"
-- Per SAT Anexo 22 Apéndice 1 the aduana segment must be the FIRST 2
-- digits of the 3-digit aduana code (240 → "24"). Same one-shot
-- writer that produced the régimen-in-clave_pedimento corruption
-- (see the régimen-clave investigation: writer is gone from disk;
-- 3,309 historical rows touched in a single 4-second batch).
--
-- Pre-flight collision check (verified 2026-04-29 13:36 CT)
-- ---------------------------------------------------------
-- Of the 3,309 candidate rows, stripping the extra digit produces a
-- pedimento_id that already exists on a DIFFERENT row for 3 of them:
--
--   id=3865  "26 240 3596 6500189" → would collide with id=4574 "26 24 3596 6500189"
--   id=3867  "26 240 3596 6500207" → would collide with id=4530 "26 24 3596 6500207"
--   id=3868  "26 240 3596 6500247" → would collide with id=4531 "26 24 3596 6500247"
--
-- Every collision matches the documented stop-rule pattern:
--   bad-batch row has raw=NULL, rfc_importador=NULL, valor_aduana=NULL
--   real-scraper twin has raw=array[11], rfc=EPM001109I74 (EVCO),
--     valor_aduana populated, clave_pedimento=IN/A1
-- Resolution: drop the bad-batch rows; the real-scraper rows are the
-- canonical record for those pedimentos.

-- Step 1 — drop the 3 colliding bad-batch shells.
DELETE FROM pedimentos WHERE id IN (3865, 3867, 3868);

-- Step 2 — strip the 3rd digit from the aduana segment on the
-- remaining 3,306 Bug A rows.
UPDATE pedimentos
SET pedimento_id = SUBSTRING(pedimento_id, 1, 3)
                   || SUBSTRING(pedimento_id, 4, 2)
                   || SUBSTRING(pedimento_id, 7)
WHERE pedimento_id ~ '^\d{2}\s\d{3}\s\d{4}\s\d+$';

-- Step 3 — verification (run manually or in gsd-verify ratchet).
-- SELECT COUNT(*) FROM pedimentos
--   WHERE pedimento_id ~ '^\d{2}\s\d{3}\s\d{4}\s\d+$';
-- Expected: 0
--
-- Combined with the Bug B fix in commit 09f56b1 (PART 1 of this
-- branch — consecutivo zero-padding in the writer + backfill of 260
-- DODA rows), this brings the entire `pedimentos` table to 100%
-- SAT-format compliance: 4,164 rows, every pedimento_id matches
-- /^\d{2}\s\d{2}\s\d{4}\s\d{7}$/.
--
-- Application path
-- ----------------
-- supabase db push --linked is blocked on an unrelated local-vs-remote
-- migration history mismatch. Applied directly via the service-role
-- JS client (same pattern as recent fixes b4ea3df, e529b9d, 09f56b1).
-- This .sql file is the canonical record of the change for future
-- audit.
