-- 20260429_globalpc_productos_deleted_at.sql
--
-- FIX 4 of audit-sync-pipeline-2026-04-29 — soft-delete column for
-- the productos catalog mirror.
--
-- Problem: globalpc-sync.js writes via UPSERT only, never DELETE.
-- When a row is removed at GlobalPC source (rename / dedup / cleanup),
-- the mirror keeps the obsolete row forever. Audit found ~22,360 stale
-- productos for EVCO clave 9254 alone (mirror 148,537 vs source
-- 126,177 — 17.7% drift). For some inactive clients (e.g. clave 9089)
-- the drift is 270%.
--
-- We DO NOT hard-delete because historical pedimentos reference
-- productos by (cve_producto, cve_cliente, cve_proveedor); deleting a
-- mirror row would break that audit chain. Instead we soft-delete
-- with `deleted_at` and let readers filter.
--
-- This migration:
--   1. Adds `deleted_at` column (nullable, default NULL)
--   2. Adds a partial index on `(cve_cliente, deleted_at)` so
--      "active rows for client X" queries stay fast even at scale
--   3. Adds a comment explaining the column's role for future readers

ALTER TABLE globalpc_productos
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN globalpc_productos.deleted_at IS
  'Soft-delete tombstone — set by scripts/globalpc-productos-reconcile.js when a mirror row is no longer present in the GlobalPC MySQL source for the same (cve_producto, cve_cliente, cve_proveedor). Active readers MUST filter `deleted_at IS NULL`. Historical pedimentos still resolve cve_producto via this table even after soft-delete.';

-- Partial index on (cve_cliente, deleted_at IS NULL) to keep the
-- catalog-list query fast. NULL is the active state, so we index the
-- NULL-bearing rows specifically.
CREATE INDEX IF NOT EXISTS idx_globalpc_productos_active_by_client
  ON globalpc_productos (cve_cliente)
  WHERE deleted_at IS NULL;

-- Backfill assertion: every existing row stays active (deleted_at NULL)
-- by default — no UPDATE needed because the column default is NULL.
