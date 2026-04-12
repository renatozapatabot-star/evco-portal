-- Block 1 · Tráfico Detail — events_catalog
-- Seeds 55 canonical GlobalPC event types across 9 categories.
-- Source: docs/recon/V2_GLOBALPC_RECON.md

CREATE TABLE IF NOT EXISTS events_catalog (
  event_type text PRIMARY KEY,
  category text NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('public','private')),
  display_name_es text NOT NULL,
  description_es text,
  icon_name text,
  color_token text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_catalog_category ON events_catalog(category);
ALTER TABLE events_catalog ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='events_catalog' AND policyname='read_all_authenticated') THEN
    CREATE POLICY "read_all_authenticated" ON events_catalog FOR SELECT USING (true);
  END IF;
END $$;

INSERT INTO events_catalog (event_type, category, visibility, display_name_es, description_es, icon_name, color_token) VALUES
  -- LIFECYCLE (11)
  ('warehouse_entry_received', 'lifecycle', 'private', 'Recepción en bodega', 'Mercancía recibida en almacén', 'package', 'ACCENT_CYAN'),
  ('trafico_created', 'lifecycle', 'public', 'Tráfico creado', 'Tráfico iniciado en el sistema', 'plus-circle', 'ACCENT_CYAN'),
  ('initial_pedimento_data_captured', 'lifecycle', 'private', 'Datos iniciales capturados', 'Datos iniciales del pedimento capturados', 'file-text', 'ACCENT_CYAN'),
  ('invoices_assigned', 'lifecycle', 'private', 'Facturas asignadas', 'Facturas asignadas al tráfico', 'receipt', 'ACCENT_CYAN'),
  ('classification_sheet_generated', 'lifecycle', 'private', 'Hoja de clasificación generada', 'Hoja de clasificación emitida', 'layers', 'ACCENT_CYAN'),
  ('pedimento_interface_generated', 'lifecycle', 'private', 'Interfaz de pedimento generada', 'Archivo de interfaz enviado al sistema de pedimentos', 'upload', 'ACCENT_CYAN'),
  ('payment_notice_issued', 'lifecycle', 'private', 'Aviso de pago emitido', 'Aviso de pago emitido para el tráfico', 'dollar-sign', 'GOLD'),
  ('load_order_issued', 'lifecycle', 'public', 'Orden de carga emitida', 'Orden de carga para salida de mercancía', 'truck', 'ACCENT_CYAN'),
  ('merchandise_customs_cleared', 'lifecycle', 'public', 'Mercancía despachada', 'Mercancía despachada libre en aduana', 'check-circle', 'GREEN'),
  ('customs_clearance_notice_issued', 'lifecycle', 'public', 'Aviso de despacho emitido', 'Aviso de despacho aduanero emitido', 'bell', 'ACCENT_CYAN'),
  ('digital_file_generated', 'lifecycle', 'private', 'Expediente digital generado', 'Expediente con COVE, XML y acuses generado', 'folder', 'ACCENT_CYAN'),
  -- BANK PAYMENTS (11)
  ('payment_banamex', 'payment', 'private', 'Pago BANAMEX', 'Pago registrado en BANAMEX', 'credit-card', 'GOLD'),
  ('payment_bancomer', 'payment', 'private', 'Pago BBVA Bancomer', 'Pago registrado en BBVA Bancomer', 'credit-card', 'GOLD'),
  ('payment_banjercito', 'payment', 'private', 'Pago BANJERCITO', 'Pago registrado en BANJERCITO', 'credit-card', 'GOLD'),
  ('payment_banorte', 'payment', 'private', 'Pago BANORTE', 'Pago registrado en BANORTE', 'credit-card', 'GOLD'),
  ('payment_bbva', 'payment', 'private', 'Pago BBVA', 'Pago registrado en BBVA', 'credit-card', 'GOLD'),
  ('payment_citibank', 'payment', 'private', 'Pago Citibank', 'Pago registrado en Citibank', 'credit-card', 'GOLD'),
  ('payment_hsbc', 'payment', 'private', 'Pago HSBC', 'Pago registrado en HSBC', 'credit-card', 'GOLD'),
  ('payment_inverlat', 'payment', 'private', 'Pago Inverlat', 'Pago registrado en Inverlat', 'credit-card', 'GOLD'),
  ('payment_promex', 'payment', 'private', 'Pago Promex', 'Pago registrado en Promex', 'credit-card', 'GOLD'),
  ('payment_santander_serfin', 'payment', 'private', 'Pago Santander-Serfín', 'Pago registrado en Santander', 'credit-card', 'GOLD'),
  ('payment_all_banks', 'payment', 'private', 'Pago (multi-banco)', 'Pago registrado en múltiples bancos', 'credit-card', 'GOLD'),
  -- INSPECTION (8)
  ('semaforo_first_green', 'inspection', 'public', 'Semáforo 1° verde', 'Primera selección verde — paso libre', 'check-circle', 'GREEN'),
  ('semaforo_first_red', 'inspection', 'public', 'Semáforo 1° rojo', 'Primera selección roja — revisión', 'alert-circle', 'RED'),
  ('semaforo_second_green', 'inspection', 'public', 'Semáforo 2° verde', 'Segunda selección verde', 'check-circle', 'GREEN'),
  ('semaforo_second_red', 'inspection', 'public', 'Semáforo 2° rojo', 'Segunda selección roja', 'alert-circle', 'RED'),
  ('recognition_first_without_incidents', 'inspection', 'private', 'Primer reconocimiento sin incidencias', 'Revisión 1 sin hallazgos', 'eye', 'GREEN'),
  ('recognition_first_with_incidents', 'inspection', 'private', 'Primer reconocimiento con incidencias', 'Revisión 1 con hallazgos', 'eye-off', 'RED'),
  ('recognition_second_without_incidents', 'inspection', 'private', 'Segundo reconocimiento sin incidencias', 'Revisión 2 sin hallazgos', 'eye', 'GREEN'),
  ('recognition_second_with_incidents', 'inspection', 'private', 'Segundo reconocimiento con incidencias', 'Revisión 2 con hallazgos', 'eye-off', 'RED'),
  -- EXCEPTION (4)
  ('embargo_initiated', 'exception', 'public', 'Embargo iniciado', 'Embargo de mercancía iniciado', 'shield-off', 'RED'),
  ('rectification_filed', 'exception', 'private', 'Rectificación presentada', 'Rectificación de pedimento presentada', 'edit', 'GOLD'),
  ('investigation_opened', 'exception', 'private', 'Investigación abierta', 'Investigación del tráfico iniciada', 'search', 'RED'),
  ('investigation_closed', 'exception', 'private', 'Investigación cerrada', 'Investigación cerrada', 'check', 'GREEN'),
  -- EXPORT (2)
  ('aes_itn_received', 'export', 'private', 'ITN AES recibido', 'Número ITN recibido del sistema AES', 'check-circle', 'ACCENT_CYAN'),
  ('aes_direct_filed', 'export', 'private', 'AES Direct presentado', 'Declaración presentada a AES Direct', 'upload', 'ACCENT_CYAN'),
  -- LOAD ORDER (4)
  ('load_order_created', 'load_order', 'private', 'Orden de carga creada', 'Orden de carga creada en el sistema', 'clipboard', 'ACCENT_CYAN'),
  ('load_order_processed_v2', 'load_order', 'private', 'Orden procesada (v2)', 'Orden de carga procesada con v2.0', 'clipboard-check', 'ACCENT_CYAN'),
  ('load_order_post_processed', 'load_order', 'private', 'Post-procesamiento orden', 'Post-procesamiento especial de orden de carga', 'edit', 'ACCENT_CYAN'),
  ('load_order_warehouse_exit', 'load_order', 'public', 'Salida de bodega', 'Mercancía salida de bodega', 'truck', 'GREEN'),
  -- VUCEM (5)
  ('cove_requested', 'vucem', 'private', 'COVE solicitado', 'Comprobante de Valor Electrónico solicitado', 'cloud-upload', 'ACCENT_CYAN'),
  ('cove_received', 'vucem', 'private', 'COVE recibido', 'COVE recibido del portal VUCEM', 'cloud-download', 'ACCENT_CYAN'),
  ('cove_u4_validated', 'vucem', 'private', 'COVE validado (U4)', 'COVE validado a nivel U4', 'check-circle', 'GREEN'),
  ('vucem_file_generated', 'vucem', 'private', 'Archivo VUCEM generado', 'Archivo de interfaz VUCEM generado', 'file', 'ACCENT_CYAN'),
  ('vucem_acknowledgment_received', 'vucem', 'private', 'Acuse VUCEM recibido', 'Acuse de recepción VUCEM recibido', 'check', 'GREEN'),
  -- DOCUMENT (6)
  ('documents_received', 'document', 'private', 'Documentos recibidos', 'Documentos del tráfico recibidos', 'file-plus', 'ACCENT_CYAN'),
  ('documents_verified', 'document', 'private', 'Documentos verificados', 'Documentos verificados por operador', 'file-check', 'GREEN'),
  ('documents_sent_to_client', 'document', 'public', 'Expediente enviado al cliente', 'Expediente enviado al cliente', 'mail', 'ACCENT_CYAN'),
  ('document_missing_flagged', 'document', 'private', 'Documento faltante marcado', 'Operador marcó un documento como faltante', 'alert-triangle', 'GOLD'),
  ('supplier_solicitation_sent', 'document', 'private', 'Solicitud al proveedor enviada', 'Solicitud de documentos enviada al proveedor', 'mail', 'ACCENT_CYAN'),
  ('supplier_solicitation_received', 'document', 'private', 'Respuesta del proveedor recibida', 'Proveedor respondió con documentos', 'mail-check', 'GREEN'),
  -- MANUAL / OPERATOR (4)
  ('operator_note_added', 'manual', 'private', 'Nota agregada', 'Operador agregó nota al tráfico', 'message-square', 'TEXT_MUTED'),
  ('operator_assigned', 'manual', 'private', 'Operador asignado', 'Operador asignado al tráfico', 'user-plus', 'ACCENT_CYAN'),
  ('operator_handoff', 'manual', 'private', 'Entrega entre operadores', 'Tráfico transferido a otro operador', 'users', 'ACCENT_CYAN'),
  ('operator_escalation', 'manual', 'public', 'Escalación al broker', 'Tráfico escalado al broker para decisión', 'arrow-up', 'GOLD')
ON CONFLICT (event_type) DO NOTHING;
