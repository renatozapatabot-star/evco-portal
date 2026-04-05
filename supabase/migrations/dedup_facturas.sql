-- Deduplicate aduanet_facturas by referencia + clave_cliente
-- DO NOT RUN without reviewing which duplicates will be deleted
-- This keeps the row with the lowest id for each (referencia, clave_cliente) pair

BEGIN;

-- Step 1: Delete duplicate rows, keeping the one with the smallest id
DELETE FROM aduanet_facturas
WHERE id NOT IN (
  SELECT MIN(id)
  FROM aduanet_facturas
  WHERE referencia IS NOT NULL
  GROUP BY referencia, clave_cliente
)
AND referencia IS NOT NULL;

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE aduanet_facturas
  ADD CONSTRAINT uq_facturas_referencia_cliente
  UNIQUE (referencia, clave_cliente);

COMMIT;
