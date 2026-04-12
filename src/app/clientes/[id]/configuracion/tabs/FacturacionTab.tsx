'use client'

import { useAutosaveJsonField } from '@/lib/hooks/useAutosaveJsonField'
import type { FacturacionConfig } from '@/lib/client-config-schema'
import { FieldGrid, NumberField, SelectField, TextField } from '../_components/FieldPrimitives'
import { SectionAutosaveBadge } from '../_components/SectionAutosaveBadge'
import { TabHeader } from '../_components/TabHeader'

const METODO_OPTS = [
  { value: 'transferencia' as const, label: 'Transferencia' },
  { value: 'cheque'        as const, label: 'Cheque' },
  { value: 'efectivo'      as const, label: 'Efectivo' },
  { value: 'credito'       as const, label: 'Crédito' },
]

const MONEDA_OPTS = [
  { value: 'MXN' as const, label: 'MXN' },
  { value: 'USD' as const, label: 'USD' },
]

export interface FacturacionTabProps {
  companyId: string
  initial: FacturacionConfig
  onSaved: () => void
}

export function FacturacionTab({ companyId, initial, onSaved }: FacturacionTabProps) {
  const { value, setValue, flush, status, lastSaved, errorMessage } =
    useAutosaveJsonField<FacturacionConfig>({
      companyId,
      section: 'configuracion_facturacion',
      initialValue: initial,
      onSaved: () => onSaved(),
    })
  function patch(p: Partial<FacturacionConfig>) {
    setValue({ ...value, ...p })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TabHeader
        title="Configuración Facturación"
        subtitle="Método de pago, plazo y moneda base con los que se emitirá la factura al cliente."
        badge={<SectionAutosaveBadge status={status} lastSaved={lastSaved} errorMessage={errorMessage} />}
      />
      <FieldGrid>
        <SelectField
          label="Método de pago"
          required
          value={value.metodo_pago}
          onChange={v => patch({ metodo_pago: v })}
          onBlur={flush}
          options={METODO_OPTS}
          placeholder="— seleccionar —"
        />
        <NumberField label="Plazo (días)" required min={0} max={365} step={1} value={value.plazo_dias} onChange={v => patch({ plazo_dias: v })} onBlur={flush} />
        <SelectField
          label="Moneda"
          required
          value={value.moneda}
          onChange={v => patch({ moneda: v })}
          onBlur={flush}
          options={MONEDA_OPTS}
          placeholder="— seleccionar —"
        />
        <TextField label="Email de facturación" type="email" value={value.email_facturacion ?? ''} onChange={v => patch({ email_facturacion: v })} onBlur={flush} placeholder="facturacion@empresa.com" />
      </FieldGrid>
    </div>
  )
}
