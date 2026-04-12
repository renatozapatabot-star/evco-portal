'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useAutosaveJsonField } from '@/lib/hooks/useAutosaveJsonField'
import type { DireccionRow, DireccionTipo } from '@/lib/client-config-schema'
import {
  ActionButton,
  FieldGrid,
  RowCard,
  SelectField,
  TextField,
} from '../_components/FieldPrimitives'
import { SectionAutosaveBadge } from '../_components/SectionAutosaveBadge'
import { TabHeader } from '../_components/TabHeader'
import { TEXT_MUTED } from '@/lib/design-system'

const TIPO_OPTS: readonly { value: DireccionTipo; label: string }[] = [
  { value: 'fiscal',   label: 'Fiscal' },
  { value: 'embarque', label: 'Embarque' },
  { value: 'entrega',  label: 'Entrega' },
  { value: 'sucursal', label: 'Sucursal' },
] as const

export interface DireccionesTabProps {
  companyId: string
  initial: DireccionRow[]
  onSaved: () => void
}

export function DireccionesTab({ companyId, initial, onSaved }: DireccionesTabProps) {
  const { value, setValue, flush, status, lastSaved, errorMessage } =
    useAutosaveJsonField<DireccionRow[]>({
      companyId,
      section: 'direcciones',
      initialValue: initial,
      onSaved: () => onSaved(),
    })

  function addRow() {
    setValue([...value, { tipo: 'fiscal', pais: 'MX' }])
  }
  function removeRow(idx: number) {
    setValue(value.filter((_, i) => i !== idx))
  }
  function patchRow(idx: number, patch: Partial<DireccionRow>) {
    setValue(value.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TabHeader
        title="Direcciones"
        subtitle="Domicilio fiscal, plantas, bodegas de entrega. Se requiere al menos una dirección fiscal."
        badge={<SectionAutosaveBadge status={status} lastSaved={lastSaved} errorMessage={errorMessage} />}
      />
      {value.length === 0 && (
        <p style={{ margin: 0, color: TEXT_MUTED, fontSize: 13 }}>
          Sin direcciones registradas.
        </p>
      )}
      {value.map((row, idx) => (
        <RowCard key={idx}>
          <FieldGrid>
            <SelectField
              label="Tipo"
              required
              value={row.tipo}
              onChange={v => patchRow(idx, { tipo: v ?? 'fiscal' })}
              onBlur={flush}
              options={TIPO_OPTS}
            />
            <TextField label="País" required value={row.pais ?? 'MX'} onChange={v => patchRow(idx, { pais: v })} onBlur={flush} />
            <TextField label="Calle" required value={row.calle ?? ''} onChange={v => patchRow(idx, { calle: v })} onBlur={flush} />
            <TextField label="Número exterior" value={row.numero_exterior ?? ''} onChange={v => patchRow(idx, { numero_exterior: v })} onBlur={flush} mono />
            <TextField label="Número interior" value={row.numero_interior ?? ''} onChange={v => patchRow(idx, { numero_interior: v })} onBlur={flush} mono />
            <TextField label="Colonia" value={row.colonia ?? ''} onChange={v => patchRow(idx, { colonia: v })} onBlur={flush} />
            <TextField label="Ciudad" required value={row.ciudad ?? ''} onChange={v => patchRow(idx, { ciudad: v })} onBlur={flush} />
            <TextField label="Estado" required value={row.estado ?? ''} onChange={v => patchRow(idx, { estado: v })} onBlur={flush} />
            <TextField label="Código postal" required mono value={row.cp ?? ''} onChange={v => patchRow(idx, { cp: v })} onBlur={flush} maxLength={5} placeholder="88000" />
          </FieldGrid>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ActionButton variant="danger" onClick={() => removeRow(idx)}>
              <Trash2 size={14} /> Eliminar fila
            </ActionButton>
          </div>
        </RowCard>
      ))}
      <div>
        <ActionButton onClick={addRow}>
          <Plus size={14} /> Agregar dirección
        </ActionButton>
      </div>
    </div>
  )
}
