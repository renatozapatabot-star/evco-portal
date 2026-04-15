'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useAutosaveJsonField } from '@/lib/hooks/useAutosaveJsonField'
import type { DocumentoRecurrenteRow } from '@/lib/client-config-schema'
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

export interface DocumentosRecurrentesTabProps {
  companyId: string
  initial: DocumentoRecurrenteRow[]
  onSaved: () => void
}

export function DocumentosRecurrentesTab({
  companyId, initial, onSaved,
}: DocumentosRecurrentesTabProps) {
  const { value, setValue, flush, status, lastSaved, errorMessage } =
    useAutosaveJsonField<DocumentoRecurrenteRow[]>({
      companyId,
      section: 'documentos_recurrentes',
      initialValue: initial,
      onSaved: () => onSaved(),
    })

  function addRow() {
    setValue([...value, { tipo: '' }])
  }
  function removeRow(idx: number) {
    setValue(value.filter((_, i) => i !== idx))
  }
  function patchRow(idx: number, patch: Partial<DocumentoRecurrenteRow>) {
    setValue(value.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TabHeader
        title="Documentos Recurrentes"
        subtitle="Documentos cuya vigencia debe rastrearse (pólizas, permisos, cartas anuales)."
        badge={<SectionAutosaveBadge status={status} lastSaved={lastSaved} errorMessage={errorMessage} />}
      />
      {value.length === 0 && (
        <p style={{ margin: 0, color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>
          Sin documentos registrados.
        </p>
      )}
      {value.map((row, idx) => (
        <RowCard key={idx}>
          <FieldGrid>
            <TextField label="Tipo" required value={row.tipo} onChange={v => patchRow(idx, { tipo: v })} onBlur={flush} placeholder="Poliza de seguro" />
            <TextField label="Descripción" value={row.descripcion ?? ''} onChange={v => patchRow(idx, { descripcion: v })} onBlur={flush} />
            <NumberField label="Vigencia (meses)" min={1} max={120} step={1} value={row.vigencia_meses} onChange={v => patchRow(idx, { vigencia_meses: v })} onBlur={flush} />
            <TextField label="Fecha de renovación" mono value={row.fecha_renovacion ?? ''} onChange={v => patchRow(idx, { fecha_renovacion: v })} onBlur={flush} placeholder="AAAA-MM-DD" />
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
          <Plus size={14} /> Agregar documento
        </ActionButton>
      </div>
    </div>
  )
}
