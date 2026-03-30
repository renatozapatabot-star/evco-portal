-- Fix: VARCHAR(5) overflow on moneda columns and globalpc_productos.nico/umt
-- Error: "value too long for type character varying(5)" in econta_egresos sync
-- Date: 2026-03-28

ALTER TABLE econta_egresos    ALTER COLUMN moneda TYPE VARCHAR(20);
ALTER TABLE econta_ingresos   ALTER COLUMN moneda TYPE VARCHAR(20);
ALTER TABLE econta_anticipos  ALTER COLUMN moneda TYPE VARCHAR(20);
ALTER TABLE econta_cartera    ALTER COLUMN moneda TYPE VARCHAR(20);
ALTER TABLE econta_facturas   ALTER COLUMN moneda TYPE VARCHAR(20);
ALTER TABLE globalpc_productos ALTER COLUMN nico  TYPE VARCHAR(20);
ALTER TABLE globalpc_productos ALTER COLUMN umt   TYPE VARCHAR(20);
