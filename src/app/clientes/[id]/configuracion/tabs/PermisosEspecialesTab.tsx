'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useAutosaveJsonField } from '@/lib/hooks/useAutosaveJsonField'
import type { PermisoEspecialRow } from '@/lib/client-config-schema'
import {
  ActionButton,
  FieldGrid,
  RowCard,
  TextField,
} from '../_components/FieldPrimitives'
import { SectionAutosaveBadge } from '../_components/SectionAutosaveBadge'
import { TabHeader } from '../_components/TabHeader'
import { TEXT_MUTED } from '@/lib/design-system'

export interface PermisosEspecialesTabProps {
  companyId: string
  initial: PermisoEspecialRow[]
  onSaved: () => void
}

export function PermisosEspecialesTab({
  companyId, initial, onSaved,
}: PermisosEspecialesTabProps) {
  const { value, setValue, flush, status, lastSaved, errorMessage } =
    useAutosaveJsonField<PermisoEspecialRow[]>({
      companyId,
      section: 'permisos_especiales',
      initialValue: initial,
      onSaved: () => onSaved(),
    })

  function addRow() {
    setValue([...value, { tipo: '', folio: '' }])
  }
  function removeRow(idx: number) {
    setValue(value.filter((_, i) => i !== idx))
  }
  function patchRow(idx: number, patch: Partial<PermisoEspecialRow>) {
    setValue(value.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TabHeader
        title="Permisos Especiales"
        subtitle="Permisos SE, SENER, SEMARNAT, NOMs con folio controlado."
        badge={<SectionAutosaveBadge status={status} lastSaved={lastSaved} errorMessage={errorMessage} />}
      />
      {value.length === 0 && (
        <p style={{ margin: 0, color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>
          Sin permisos registrados.
        </p>
      )}
      {value.map((row, idx) => (
        <RowCard key={idx}>
          <FieldGrid>
            <TextField label="Tipo" required value={row.tipo} onChange={v => patchRow(idx, { tipo: v })} onBlur={flush} placeholder="Permiso SE" />
            <TextField label="Folio" required mono value={row.folio} onChange={v => patchRow(idx, { folio: v })} onBlur={flush} />
            <TextField label="Vigencia (AAAA-MM-DD)" mono value={row.fecha_vigencia ?? ''} onChange={v => patchRow(idx, { fecha_vigencia: v })} onBlur={flush} />
            <TextField label="Descripción" value={row.descripcion ?? ''} onChange={v => patchRow(idx, { descripcion: v })} onBlur={flush} />
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
          <Plus size={14} /> Agregar permiso
        </ActionButton>
      </div>
    </div>
  )
}
