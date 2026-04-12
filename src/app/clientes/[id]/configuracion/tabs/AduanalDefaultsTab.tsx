'use client'

import { useAutosaveJsonField } from '@/lib/hooks/useAutosaveJsonField'
import type { AduanalDefaults } from '@/lib/client-config-schema'
import { FieldGrid, SelectField, TextField } from '../_components/FieldPrimitives'
import { SectionAutosaveBadge } from '../_components/SectionAutosaveBadge'
import { TabHeader } from '../_components/TabHeader'

const TIPO_OPS = [
  { value: 'importacion' as const, label: 'Importación' },
  { value: 'exportacion' as const, label: 'Exportación' },
  { value: 'ambos'       as const, label: 'Ambos' },
]

const MONEDA_OPTS = [
  { value: 'MXN' as const, label: 'MXN' },
  { value: 'USD' as const, label: 'USD' },
  { value: 'EUR' as const, label: 'EUR' },
]

export interface AduanalDefaultsTabProps {
  companyId: string
  initial: AduanalDefaults
  onSaved: () => void
}

export function AduanalDefaultsTab({ companyId, initial, onSaved }: AduanalDefaultsTabProps) {
  const { value, setValue, flush, status, lastSaved, errorMessage } =
    useAutosaveJsonField<AduanalDefaults>({
      companyId,
      section: 'aduanal_defaults',
      initialValue: initial,
      onSaved: () => onSaved(),
    })

  function patch(p: Partial<AduanalDefaults>) {
    setValue({ ...value, ...p })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TabHeader
        title="Defaults Aduanales"
        subtitle="Patente, aduana e incoterm por defecto para operaciones de este cliente."
        badge={<SectionAutosaveBadge status={status} lastSaved={lastSaved} errorMessage={errorMessage} />}
      />
      <FieldGrid>
        <TextField label="Patente" required mono value={value.patente ?? ''} onChange={v => patch({ patente: v })} onBlur={flush} placeholder="3596" maxLength={4} />
        <TextField label="Aduana" required mono value={value.aduana ?? ''} onChange={v => patch({ aduana: v })} onBlur={flush} placeholder="240" maxLength={3} />
        <SelectField
          label="Tipo de operación"
          required
          value={value.tipo_operacion}
          onChange={v => patch({ tipo_operacion: v })}
          onBlur={flush}
          options={TIPO_OPS}
          placeholder="— seleccionar —"
        />
        <TextField label="Incoterm por defecto" mono value={value.incoterm_default ?? ''} onChange={v => patch({ incoterm_default: v.toUpperCase() })} onBlur={flush} placeholder="DAP" maxLength={5} />
        <SelectField
          label="Moneda por defecto"
          value={value.moneda_default}
          onChange={v => patch({ moneda_default: v })}
          onBlur={flush}
          options={MONEDA_OPTS}
          placeholder="— seleccionar —"
        />
      </FieldGrid>
    </div>
  )
}
