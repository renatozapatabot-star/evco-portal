'use client'

import { useAutosaveJsonField } from '@/lib/hooks/useAutosaveJsonField'
import { TextAreaField } from '../_components/FieldPrimitives'
import { SectionAutosaveBadge } from '../_components/SectionAutosaveBadge'
import { TabHeader } from '../_components/TabHeader'

export interface NotasInternasTabProps {
  companyId: string
  initial: string | null
  onSaved: () => void
}

export function NotasInternasTab({ companyId, initial, onSaved }: NotasInternasTabProps) {
  const { value, setValue, flush, status, lastSaved, errorMessage } =
    useAutosaveJsonField<string>({
      companyId,
      section: 'notas_internas',
      initialValue: initial ?? '',
      onSaved: () => onSaved(),
    })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TabHeader
        title="Notas Internas"
        subtitle="Solo visible para el broker. No se muestra al cliente en ninguna superficie."
        badge={<SectionAutosaveBadge status={status} lastSaved={lastSaved} errorMessage={errorMessage} />}
      />
      <TextAreaField
        label="Notas"
        value={value}
        onChange={v => setValue(v)}
        onBlur={flush}
        rows={12}
        placeholder="Historial, recordatorios, contexto que debe persistir entre turnos."
      />
    </div>
  )
}
