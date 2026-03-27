-- Add missing valuable fields to traficos
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS aduana VARCHAR(3);
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS patente VARCHAR(4);
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS regimen VARCHAR(5);
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS tipo_cambio DOUBLE PRECISION;
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS fecha_cruce TIMESTAMPTZ;
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS fecha_pago TIMESTAMPTZ;
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS semaforo SMALLINT;
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS contenedor VARCHAR(120);
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS peso_bruto_unidad SMALLINT;
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS bultos_recibidos INT;
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS referencia_cliente VARCHAR(25);
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS pais_procedencia VARCHAR(3);

-- Add missing fields to globalpc_productos
ALTER TABLE globalpc_productos ADD COLUMN IF NOT EXISTS descripcion_ingles TEXT;
ALTER TABLE globalpc_productos ADD COLUMN IF NOT EXISTS marca VARCHAR(70);
ALTER TABLE globalpc_productos ADD COLUMN IF NOT EXISTS precio_unitario DOUBLE PRECISION;

SELECT 'All 15 columns added' AS status;
