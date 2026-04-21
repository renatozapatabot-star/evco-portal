'use client'

import { useAutosaveJsonField } from '@/lib/hooks/useAutosaveJsonField'
import type { ClasificacionDefaults } from '@/lib/client-config-schema'
import { TextAreaField, FieldGrid, TextField } from '../_components/FieldPrimitives'
import { SectionAutosaveBadge } from '../_components/SectionAutosaveBadge'
import { TabHeader } from '../_components/TabHeader'

function toList(s: string): string[] {
  return s.split(/[,\n]/).map(x => x.trim()).filter(Boolean)
}
function fromList(xs: string[] | undefined): string {
  return (xs ?? []).join(', ')
}

export interface ClasificacionDefaultsTabProps {
  companyId: string
  initial: ClasificacionDefaults
  onSaved: () => void
}

export function ClasificacionDefaultsTab({
  companyId, initial, onSaved,
}: ClasificacionDefaultsTabProps) {
  const { value, setValue, flush, status, lastSaved, errorMessage } =
    useAutosaveJsonField<ClasificacionDefaults>({
      companyId,
      section: 'clasificacion_defaults',
      initialValue: initial,
      onSaved: () => onSaved(),
    })
  function patch(p: Partial<ClasificacionDefaults>) {
    setValue({ ...value, ...p })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TabHeader
        title="Defaults Clasificación"
        subtitle="Fracciones y NOMs favoritos — alimentan al clasificador como sesgo inicial."
        badge={<SectionAutosaveBadge status={status} lastSaved={lastSaved} errorMessage={errorMessage} />}
      />
      <FieldGrid columns={1}>
        <TextField
          label="Fracciones favoritas (separadas por coma)"
          mono
          value={fromList(value.fracciones_favoritas)}
          onChange={v => patch({ fracciones_favoritas: toList(v) })}
          onBlur={flush}
          placeholder="3901.20.01, 3926.90.99"
        />
        <TextField
          label="NOMs aplicables"
          mono
          value={fromList(value.noms_aplicables)}
          onChange={v => patch({ noms_aplicables: toList(v) })}
          onBlur={flush}
          placeholder="NOM-050-SCFI"
        />
        <TextField
          label="Permisos requeridos"
          value={fromList(value.permisos_requeridos)}
          onChange={v => patch({ permisos_requeridos: toList(v) })}
          onBlur={flush}
        />
        <TextAreaField
          label="Notas de clasificación"
          value={value.notas_clasificacion ?? ''}
          onChange={v => patch({ notas_clasificacion: v })}
          onBlur={flush}
          rows={4}
        />
      </FieldGrid>
    </div>
  )
}
