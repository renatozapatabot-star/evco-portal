'use client'

import { useAutosaveJsonField } from '@/lib/hooks/useAutosaveJsonField'
import type { GeneralConfig } from '@/lib/client-config-schema'
import { FieldGrid, TextField } from '../_components/FieldPrimitives'
import { SectionAutosaveBadge } from '../_components/SectionAutosaveBadge'
import { TabHeader } from '../_components/TabHeader'

export interface GeneralTabProps {
  companyId: string
  initial: GeneralConfig
  onSaved: () => void
}

export function GeneralTab({ companyId, initial, onSaved }: GeneralTabProps) {
  const { value, setValue, flush, status, lastSaved, errorMessage } =
    useAutosaveJsonField<GeneralConfig>({
      companyId,
      section: 'general',
      initialValue: initial,
      onSaved: () => onSaved(),
    })

  function patch(next: Partial<GeneralConfig>) {
    setValue({ ...value, ...next })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TabHeader
        title="General"
        subtitle="Nombre legal, marca comercial y presencia web del cliente."
        badge={<SectionAutosaveBadge status={status} lastSaved={lastSaved} errorMessage={errorMessage} />}
      />
      <FieldGrid>
        <TextField
          label="Razón social"
          required
          value={value.razon_social ?? ''}
          onChange={v => patch({ razon_social: v })}
          onBlur={flush}
          placeholder="EVCO Plastics de México S.A. de C.V."
        />
        <TextField
          label="Nombre comercial"
          value={value.nombre_comercial ?? ''}
          onChange={v => patch({ nombre_comercial: v })}
          onBlur={flush}
          placeholder="EVCO Plastics"
        />
        <TextField
          label="Website"
          type="url"
          value={value.website ?? ''}
          onChange={v => patch({ website: v })}
          onBlur={flush}
          placeholder="https://evcoplastics.com"
        />
        <TextField
          label="Logo URL"
          type="url"
          value={value.logo_url ?? ''}
          onChange={v => patch({ logo_url: v })}
          onBlur={flush}
          placeholder="https://…/logo.svg"
        />
      </FieldGrid>
    </div>
  )
}
