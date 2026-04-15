'use client'

/**
 * ZAPATA AI · Block 6b — Datos Generales tab (real form).
 * Every field autosaves on blur + 800ms debounce.
 */

import type { PedimentoRow } from '@/lib/pedimento-types'
import {
  DOCUMENT_TYPE_OPTIONS,
  REGIME_TYPE_OPTIONS,
  SAT_TRANSPORT_CLAVES,
} from '@/lib/pedimento-types'
import { AutosaveField } from '@/components/pedimento/AutosaveField'
import { usePedimento, errorFor } from '@/components/pedimento/PedimentoContext'
import { useTrack } from '@/lib/telemetry/useTrack'

export interface DatosGeneralesTabProps {
  pedimento: PedimentoRow
}

export function DatosGeneralesTab({ pedimento }: DatosGeneralesTabProps) {
  const { pedimentoId, validationErrors, requestValidation } = usePedimento()
  const track = useTrack()

  const onFocus = (field: string) =>
    track('page_view', { metadata: { event: 'pedimento_field_focused', pedimentoId, field } })
  const onSaved = (field: string) => {
    track('page_view', { metadata: { event: 'pedimento_field_saved', pedimentoId, field } })
    requestValidation()
  }
  const onError = (field: string, msg: string) =>
    track('page_view', { metadata: { event: 'pedimento_field_save_failed', pedimentoId, field, msg } })

  const e = (field: string): string | undefined =>
    errorFor(validationErrors, 'datos_generales', field)?.message

  type Extras = Omit<React.ComponentProps<typeof AutosaveField>, 'pedimentoId' | 'tab' | 'field' | 'label' | 'onFocus' | 'onSaved' | 'onError' | 'validationError'>
  const base = (field: string, label: string, opts: Extras): React.ComponentProps<typeof AutosaveField> => ({
    pedimentoId,
    tab: 'datos_generales' as const,
    field,
    label,
    onFocus: () => onFocus(field),
    onSaved: () => onSaved(field),
    onError: (msg: string) => onError(field, msg),
    validationError: e(field),
    ...opts,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          padding: 20,
          borderRadius: 20,
          background: 'rgba(255,255,255,0.045)',
          border: '1px solid rgba(192,197,206,0.18)',
          backdropFilter: 'blur(20px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        <AutosaveField
          {...base('patente', 'Patente', { mono: true, initialValue: pedimento.patente ?? '', nullableString: true })}
        />
        <AutosaveField
          {...base('aduana', 'Aduana', { mono: true, initialValue: pedimento.aduana ?? '', nullableString: true })}
        />
        <AutosaveField
          {...base('pre_validador', 'Pre-validador', { mono: true, initialValue: pedimento.pre_validador ?? '', nullableString: true })}
        />
        <AutosaveField
          {...base('pedimento_number', 'Número de pedimento', {
            mono: true,
            initialValue: pedimento.pedimento_number ?? '',
            placeholder: 'DD AD PPPP SSSSSSS',
            helpText: 'Formato con espacios: AA ANAM XXXXXXXX',
            nullableString: true,
          })}
        />
        <AutosaveField
          {...base('regime_type', 'Régimen', {
            variant: 'select',
            options: REGIME_TYPE_OPTIONS,
            initialValue: pedimento.regime_type ?? '',
            nullableString: true,
          })}
        />
        <AutosaveField
          {...base('document_type', 'Tipo de documento', {
            variant: 'select',
            options: DOCUMENT_TYPE_OPTIONS,
            initialValue: pedimento.document_type ?? '',
            nullableString: true,
          })}
        />
        <AutosaveField
          {...base('destination_origin', 'Destino / Origen', {
            initialValue: pedimento.destination_origin ?? '',
            nullableString: true,
          })}
        />
        <AutosaveField
          {...base('transport_entry', 'Transporte · entrada', {
            variant: 'select',
            options: SAT_TRANSPORT_CLAVES,
            initialValue: pedimento.transport_entry ?? '',
            nullableString: true,
          })}
        />
        <AutosaveField
          {...base('transport_arrival', 'Transporte · arribo', {
            variant: 'select',
            options: SAT_TRANSPORT_CLAVES,
            initialValue: pedimento.transport_arrival ?? '',
            nullableString: true,
          })}
        />
        <AutosaveField
          {...base('transport_exit', 'Transporte · salida', {
            variant: 'select',
            options: SAT_TRANSPORT_CLAVES,
            initialValue: pedimento.transport_exit ?? '',
            nullableString: true,
          })}
        />
        <AutosaveField
          {...base('exchange_rate', 'Tipo de cambio', {
            mono: true,
            numeric: true,
            initialValue: pedimento.exchange_rate !== null ? String(pedimento.exchange_rate) : '',
            placeholder: 'MXN por USD',
            helpText: 'Referencia DOF del día operativo',
          })}
        />
        <AutosaveField
          {...base('validation_signature', 'Firma validador', {
            mono: true,
            initialValue: pedimento.validation_signature ?? '',
            nullableString: true,
          })}
        />
        <AutosaveField
          {...base('bank_signature', 'Firma banco (PECE)', {
            mono: true,
            initialValue: pedimento.bank_signature ?? '',
            nullableString: true,
          })}
        />
      </div>
    </div>
  )
}
