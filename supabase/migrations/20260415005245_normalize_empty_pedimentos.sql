-- AGUILA — normalize empty-string pedimentos to NULL
--
-- Discovery 2026-04-15: the GlobalPC sync writes pedimento = '' instead of
-- NULL when a tráfico hasn't been assigned one yet. 88 tráficos affected.
-- This breaks duplicate-detection (all 88 "share" the empty string) and
-- confuses any .not('pedimento','is',null) filter in the app.
--
-- One-time normalization. Going forward, sync scripts should also write
-- NULL — that fix lives in scripts/globalpc-delta-sync.js (track separately).

UPDATE traficos
SET pedimento = NULL
WHERE pedimento = '';

-- Verification: count should be 0 after this migration runs.
-- SELECT count(*) FROM traficos WHERE pedimento = '';
