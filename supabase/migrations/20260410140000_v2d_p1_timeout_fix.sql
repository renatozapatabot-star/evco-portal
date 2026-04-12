-- =====================================================================
-- V2-D: Fix V2-B P1 Classification Pattern Timeout
-- Created: Block V2-D, April 10 2026
-- Purpose: Override statement_timeout on find_classification_patterns
--          so it can process the full 93K-product classification history.
-- =====================================================================

-- Set per-function statement_timeout to 60s.
-- This lets this specific RPC run longer while keeping
-- the default timeout for everything else.
ALTER FUNCTION find_classification_patterns(INTEGER, NUMERIC, INTEGER)
  SET statement_timeout = '60s';

-- Ensure the supporting index is analyzed with fresh statistics
ANALYZE globalpc_productos;

COMMENT ON FUNCTION find_classification_patterns IS
  'V2-B: Find supplier+product combos consistently classified to one fraccion. V2-D: timeout bumped to 60s for full 93K-row analysis.';
