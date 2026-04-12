-- Block 7 · Corridor Map landmarks
-- 9 fixed geography points rendered on the /corredor map.
-- Public read (landmarks are physical infrastructure, not client-scoped); service-role writes only.
-- Idempotent via IF NOT EXISTS + ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS corridor_landmarks (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  lat numeric(10,6) NOT NULL,
  lng numeric(10,6) NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE corridor_landmarks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'corridor_landmarks' AND policyname = 'read_all_authenticated'
  ) THEN
    CREATE POLICY "read_all_authenticated"
      ON corridor_landmarks FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'corridor_landmarks' AND policyname = 'service_role_write'
  ) THEN
    CREATE POLICY "service_role_write"
      ON corridor_landmarks FOR ALL
      USING (current_setting('role', true) = 'service_role');
  END IF;
END $$;

INSERT INTO corridor_landmarks (id, name, type, lat, lng, description) VALUES
  ('wtb',              'Puente World Trade',         'bridge_commercial', 27.503600, -99.507600, 'Cruce comercial principal'),
  ('solidarity',       'Puente Solidaridad',          'bridge_commercial', 27.529800, -99.536400, 'Cruce comercial'),
  ('lincoln_juarez',   'Puente Lincoln-Juárez',       'bridge_mixed',      27.496800, -99.506200, 'Comercial + pasajeros'),
  ('colombia',         'Puente Colombia Solidaridad', 'bridge_commercial', 27.717800, -99.619300, 'Cruce alterno al oeste'),
  ('rz_office',        'Renato Zapata & Co',          'office',            27.507800, -99.508300, 'Oficina Patente 3596'),
  ('rz_warehouse',     'Bodega Renato Zapata',        'warehouse',         27.509500, -99.510200, 'Bodega fiscalizada'),
  ('mx_transfer_yard', 'Patio de Transferencia NL',   'transfer_yard',     27.489200, -99.503100, 'Patio de maniobras Nuevo Laredo'),
  ('cbp_laredo',       'CBP Laredo',                  'customs_us',        27.503200, -99.507100, 'US Customs and Border Protection'),
  ('aduana_240',       'Aduana 240 Nuevo Laredo',     'customs_mx',        27.502400, -99.508500, 'Aduana 240')
ON CONFLICT (id) DO NOTHING;
