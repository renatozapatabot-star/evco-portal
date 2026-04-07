-- Add 'llamado' status to documento_solicitudes for call tracking from Launchpad
ALTER TABLE documento_solicitudes
  DROP CONSTRAINT IF EXISTS documento_solicitudes_status_check;

ALTER TABLE documento_solicitudes
  ADD CONSTRAINT documento_solicitudes_status_check
  CHECK (status IN ('solicitado', 'recibido', 'vencido', 'llamado'));

ALTER TABLE documento_solicitudes
  ADD COLUMN IF NOT EXISTS llamado_at timestamptz;
