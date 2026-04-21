'use client'

import { useAutosaveJsonField } from '@/lib/hooks/useAutosaveJsonField'
import type { FiscalConfig } from '@/lib/client-config-schema'
import { FieldGrid, TextField } from '../_components/FieldPrimitives'
import { SectionAutosaveBadge } from '../_components/SectionAutosaveBadge'
import { TabHeader } from '../_components/TabHeader'

export interface FiscalTabProps {
  companyId: string
  initial: FiscalConfig
  onSaved: () => void
}

export function FiscalTab({ companyId, initial, onSaved }: FiscalTabProps) {
  const { value, setValue, flush, status, lastSaved, errorMessage } =
    useAutosaveJsonField<FiscalConfig>({
      companyId,
      section: 'fiscal',
      initialValue: initial,
      onSaved: () => onSaved(),
    })
  function patch(p: Partial<FiscalConfig>) {
    setValue({ ...value, ...p })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TabHeader
        title="Fiscal"
        subtitle="RFC, régimen fiscal y uso de CFDI. RFC obligatorio con formato SAT."
        badge={<SectionAutosaveBadge status={status} lastSaved={lastSaved} errorMessage={errorMessage} />}
      />
      <FieldGrid>
        <TextField label="RFC" required mono value={value.rfc ?? ''} onChange={v => patch({ rfc: v.toUpperCase() })} onBlur={flush} placeholder="XAXX010101ABC" maxLength={13} />
        <TextField label="Régimen fiscal (clave SAT)" required mono value={value.regimen_fiscal ?? ''} onChange={v => patch({ regimen_fiscal: v })} onBlur={flush} placeholder="601" maxLength={5} />
        <TextField label="Uso CFDI" mono value={value.uso_cfdi ?? ''} onChange={v => patch({ uso_cfdi: v })} onBlur={flush} placeholder="G03" maxLength={5} />
        <TextField label="URL constancia situación fiscal" type="url" value={value.csf_url ?? ''} onChange={v => patch({ csf_url: v })} onBlur={flush} />
      </FieldGrid>
    </div>
  )
}
