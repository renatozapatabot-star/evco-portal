'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useAutosaveJsonField } from '@/lib/hooks/useAutosaveJsonField'
import type { TransportistaPreferidoRow } from '@/lib/client-config-schema'
import {
  ActionButton,
  FieldGrid,
  NumberField,
  RowCard,
  TextField,
} from '../_components/FieldPrimitives'
import { SectionAutosaveBadge } from '../_components/SectionAutosaveBadge'
import { TabHeader } from '../_components/TabHeader'
import { TEXT_MUTED } from '@/lib/design-system'

export interface TransportistasPreferidosTabProps {
  companyId: string
  initial: TransportistaPreferidoRow[]
  onSaved: () => void
}

export function TransportistasPreferidosTab({
  companyId, initial, onSaved,
}: TransportistasPreferidosTabProps) {
  const { value, setValue, flush, status, lastSaved, errorMessage } =
    useAutosaveJsonField<TransportistaPreferidoRow[]>({
      companyId,
      section: 'transportistas_preferidos',
      initialValue: initial,
      onSaved: () => onSaved(),
    })

  function addRow() {
    setValue([...value, { carrier_id: '', prioridad: value.length + 1 }])
  }
  function removeRow(idx: number) {
    setValue(value.filter((_, i) => i !== idx))
  }
  function patchRow(idx: number, patch: Partial<TransportistaPreferidoRow>) {
    setValue(value.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TabHeader
        title="Transportistas Preferidos"
        subtitle="Orden de preferencia cuando la solicitud no especifica transportista. Se referencia por carrier_id del catálogo."
        badge={<SectionAutosaveBadge status={status} lastSaved={lastSaved} errorMessage={errorMessage} />}
      />
      {value.length === 0 && (
        <p style={{ margin: 0, color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>
          Sin transportistas preferidos.
        </p>
      )}
      {value.map((row, idx) => (
        <RowCard key={idx}>
          <FieldGrid>
            <TextField label="Carrier ID" required mono value={row.carrier_id} onChange={v => patchRow(idx, { carrier_id: v })} onBlur={flush} />
            <TextField label="Nombre (referencia)" value={row.carrier_name ?? ''} onChange={v => patchRow(idx, { carrier_name: v })} onBlur={flush} />
            <NumberField label="Prioridad" required min={1} max={99} step={1} value={row.prioridad} onChange={v => patchRow(idx, { prioridad: v ?? 1 })} onBlur={flush} />
          </FieldGrid>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ActionButton variant="danger" onClick={() => removeRow(idx)}>
              <Trash2 size={14} /> Eliminar
            </ActionButton>
          </div>
        </RowCard>
      ))}
      <div>
        <ActionButton onClick={addRow}>
          <Plus size={14} /> Agregar transportista
        </ActionButton>
      </div>
    </div>
  )
}
