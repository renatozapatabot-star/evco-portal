'use client'

import { useAutosaveJsonField } from '@/lib/hooks/useAutosaveJsonField'
import type { NotificacionesConfig } from '@/lib/client-config-schema'
import { FieldGrid, SelectField, TextField } from '../_components/FieldPrimitives'
import { SectionAutosaveBadge } from '../_components/SectionAutosaveBadge'
import { TabHeader } from '../_components/TabHeader'

const CANAL_OPTS = [
  { value: 'email'    as const, label: 'Email' },
  { value: 'telegram' as const, label: 'Telegram' },
  { value: 'whatsapp' as const, label: 'WhatsApp' },
]

function toList(s: string): string[] {
  return s.split(/[,\n]/).map(x => x.trim()).filter(Boolean)
}

export interface NotificacionesTabProps {
  companyId: string
  initial: NotificacionesConfig
  onSaved: () => void
}

export function NotificacionesTab({ companyId, initial, onSaved }: NotificacionesTabProps) {
  const { value, setValue, flush, status, lastSaved, errorMessage } =
    useAutosaveJsonField<NotificacionesConfig>({
      companyId,
      section: 'notificaciones',
      initialValue: initial,
      onSaved: () => onSaved(),
    })
  function patch(p: Partial<NotificacionesConfig>) {
    setValue({ ...value, ...p })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TabHeader
        title="Notificaciones"
        subtitle="Canal preferido y destinatarios de alertas operativas."
        badge={<SectionAutosaveBadge status={status} lastSaved={lastSaved} errorMessage={errorMessage} />}
      />
      <FieldGrid>
        <SelectField
          label="Canal preferido"
          required
          value={value.canal_preferido}
          onChange={v => patch({ canal_preferido: v })}
          onBlur={flush}
          options={CANAL_OPTS}
          placeholder="— seleccionar —"
        />
        <TextField
          label="Email alerts (coma separados)"
          value={(value.email_alerts ?? []).join(', ')}
          onChange={v => patch({ email_alerts: toList(v) })}
          onBlur={flush}
          placeholder="ops@empresa.com, facturacion@empresa.com"
        />
        <TextField label="Telegram chat ID" mono value={value.telegram_chat_id ?? ''} onChange={v => patch({ telegram_chat_id: v })} onBlur={flush} placeholder="-100…" />
        <TextField label="WhatsApp número" mono value={value.whatsapp_numero ?? ''} onChange={v => patch({ whatsapp_numero: v })} onBlur={flush} placeholder="+52 867 …" />
      </FieldGrid>
    </div>
  )
}
