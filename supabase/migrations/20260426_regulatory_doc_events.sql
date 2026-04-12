-- Block 16 · Regulatory doc generation events
-- Adds doda_generated, carta_porte_generated, avc_generated to events_catalog
-- so Cronología timelines can render them when generators fire.

INSERT INTO events_catalog (event_type, category, visibility, display_name_es, description_es, icon_name, color_token) VALUES
  ('doda_generated',         'lifecycle', 'private', 'DODA generada',         'Documento de operación para despacho aduanero generado (PDF + XML)', 'file-text', 'ACCENT_CYAN'),
  ('carta_porte_generated',  'lifecycle', 'private', 'Carta Porte generada',  'CFDI con Complemento Carta Porte generado (PDF + XML)',              'truck',     'ACCENT_CYAN'),
  ('avc_generated',          'lifecycle', 'private', 'AVC generado',          'Aviso de cruce generado (PDF + XML)',                                 'bell',      'ACCENT_CYAN')
ON CONFLICT (event_type) DO NOTHING;
