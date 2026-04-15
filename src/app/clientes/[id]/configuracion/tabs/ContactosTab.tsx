'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useAutosaveJsonField } from '@/lib/hooks/useAutosaveJsonField'
import type { ContactoRow, ContactoRol } from '@/lib/client-config-schema'
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

const ROL_OPTS: readonly { value: ContactoRol; label: string }[] = [
  { value: 'principal',   label: 'Principal' },
  { value: 'facturacion', label: 'Facturación' },
  { value: 'operaciones', label: 'Operaciones' },
  { value: 'aduanal',     label: 'Aduanal' },
  { value: 'otro',        label: 'Otro' },
] as const

export interface ContactosTabProps {
  companyId: string
  initial: ContactoRow[]
  onSaved: () => void
}

export function ContactosTab({ companyId, initial, onSaved }: ContactosTabProps) {
  const { value, setValue, flush, status, lastSaved, errorMessage } =
    useAutosaveJsonField<ContactoRow[]>({
      companyId,
      section: 'contactos',
      initialValue: initial,
      onSaved: () => onSaved(),
    })

  function addRow() {
    setValue([...value, { nombre: '', rol: 'principal' }])
  }
  function removeRow(idx: number) {
    setValue(value.filter((_, i) => i !== idx))
  }
  function patchRow(idx: number, patch: Partial<ContactoRow>) {
    setValue(value.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TabHeader
        title="Contactos"
        subtitle="Personas a quienes ZAPATA AI escribe. Se requiere al menos un contacto con rol principal o facturación cuando hay RFC."
        badge={<SectionAutosaveBadge status={status} lastSaved={lastSaved} errorMessage={errorMessage} />}
      />
      {value.length === 0 && (
        <p style={{ margin: 0, color: TEXT_MUTED, fontSize: 13 }}>
          Sin contactos registrados.
        </p>
      )}
      {value.map((row, idx) => (
        <RowCard key={idx}>
          <FieldGrid>
            <TextField label="Nombre" required value={row.nombre} onChange={v => patchRow(idx, { nombre: v })} onBlur={flush} />
            <SelectField
              label="Rol"
              required
              value={row.rol}
              onChange={v => patchRow(idx, { rol: v ?? 'otro' })}
              onBlur={flush}
              options={ROL_OPTS}
            />
            <TextField label="Puesto" value={row.puesto ?? ''} onChange={v => patchRow(idx, { puesto: v })} onBlur={flush} />
            <TextField label="Email" type="email" value={row.email ?? ''} onChange={v => patchRow(idx, { email: v })} onBlur={flush} placeholder="contacto@empresa.com" />
            <TextField label="Teléfono" type="tel" value={row.telefono ?? ''} onChange={v => patchRow(idx, { telefono: v })} onBlur={flush} mono placeholder="+52 867 …" />
          </FieldGrid>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ActionButton variant="danger" onClick={() => removeRow(idx)}>
              <Trash2 size={14} /> Eliminar contacto
            </ActionButton>
          </div>
        </RowCard>
      ))}
      <div>
        <ActionButton onClick={addRow}>
          <Plus size={14} /> Agregar contacto
        </ActionButton>
      </div>
    </div>
  )
}
