'use client'

import { useCallback } from 'react'
import {
  BORDER_HAIRLINE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import {
  GROUPING_MODES,
  ORDERING_MODES,
  type ClassificationSheetConfig,
  type GroupingMode,
  type OrderingMode,
  type PrintToggles,
  type RestrictionPrintMode,
  type SpecificDescriptionOption,
} from '@/types/classification'

const GROUPING_LABELS: Record<GroupingMode, string> = {
  none: 'Sin agrupación (una partida por producto)',
  fraction_country_umc: 'Fracción + País + UMC',
  fraction_umc_country: 'Fracción + UMC + País',
  fraction_umc_country_certified: '+ Certificado T-MEC',
  fraction_umc_country_cert_invoice: '+ Cert. + Factura',
  fraction_umc_country_product_key: '+ Clave producto',
  fraction_umc_country_product_desc: '+ Descripción producto',
  fraction_umc_country_desc_cert: '+ Descripción + Cert.',
  subheading_fraction_umc_country: 'Subpartida + Fracción + UMC + País',
}

const ORDERING_LABELS: Record<OrderingMode, string> = {
  fraction_asc: 'Fracción ascendente',
  invoice_capture_item: 'Factura · captura · partida',
  invoice_number_asc: 'Número de factura ascendente',
  fraction_country_desc_umc: 'Fracción · país · descripción · UMC',
}

const DESC_LABELS: Record<SpecificDescriptionOption, string> = {
  none: 'No incluir descripción específica',
  marca_modelo: 'Marca + Modelo',
  marca_modelo_serie: 'Marca + Modelo + Serie',
  full_detail: 'Detalle completo',
}

const RESTRICTION_LABELS: Record<RestrictionPrintMode, string> = {
  inline: 'Incluir en la partida',
  separate_annex: 'Anexo separado',
  omit: 'Omitir',
}

const TOGGLE_SECTIONS: Array<{
  title: string
  keys: Array<keyof PrintToggles>
}> = [
  {
    title: 'Identificación',
    keys: ['print_fraction', 'print_description', 'print_umc', 'print_country_origin'],
  },
  {
    title: 'Cantidades y valores',
    keys: ['print_quantity', 'print_unit_value', 'print_total_value'],
  },
  {
    title: 'Comercial',
    keys: [
      'print_invoice_number',
      'print_supplier',
      'print_tmec',
      'print_marca_modelo',
      'print_restrictions',
    ],
  },
]

const TOGGLE_LABELS: Record<keyof PrintToggles, string> = {
  print_fraction: 'Fracción',
  print_description: 'Descripción',
  print_umc: 'UMC',
  print_country_origin: 'País de origen',
  print_quantity: 'Cantidad',
  print_unit_value: 'Valor unitario',
  print_total_value: 'Valor total',
  print_invoice_number: 'Número de factura',
  print_supplier: 'Proveedor',
  print_tmec: 'T-MEC',
  print_marca_modelo: 'Marca / Modelo',
  print_restrictions: 'Restricciones',
}

interface Props {
  traficoId: string
  config: ClassificationSheetConfig
  onChange: (next: ClassificationSheetConfig, event?: string) => void
}

export function ConfigForm({ traficoId: _traficoId, config, onChange }: Props) {
  const setField = useCallback(
    <K extends keyof ClassificationSheetConfig>(
      key: K,
      value: ClassificationSheetConfig[K],
      event?: string,
    ) => {
      onChange({ ...config, [key]: value }, event)
    },
    [config, onChange],
  )

  const setToggle = useCallback(
    (key: keyof PrintToggles, value: boolean) => {
      onChange(
        { ...config, print_toggles: { ...config.print_toggles, [key]: value } },
        'classification_toggle_changed',
      )
    },
    [config, onChange],
  )

  const setRecipients = useCallback(
    (raw: string) => {
      const list = raw
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter((s) => s.includes('@'))
      onChange(
        { ...config, email_recipients: list },
        'classification_recipients_changed',
      )
    },
    [config, onChange],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionLabel>Agrupación</SectionLabel>
      <select
        value={config.grouping_mode}
        onChange={(e) =>
          setField(
            'grouping_mode',
            e.target.value as GroupingMode,
            'classification_grouping_changed',
          )
        }
        style={selectStyle}
      >
        {GROUPING_MODES.map((m) => (
          <option key={m} value={m}>
            {GROUPING_LABELS[m]}
          </option>
        ))}
      </select>

      <SectionLabel>Orden</SectionLabel>
      <select
        value={config.ordering_mode}
        onChange={(e) =>
          setField(
            'ordering_mode',
            e.target.value as OrderingMode,
            'classification_ordering_changed',
          )
        }
        style={selectStyle}
      >
        {ORDERING_MODES.map((m) => (
          <option key={m} value={m}>
            {ORDERING_LABELS[m]}
          </option>
        ))}
      </select>

      <SectionLabel>Descripción específica</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(Object.keys(DESC_LABELS) as SpecificDescriptionOption[]).map((k) => (
          <RadioRow
            key={k}
            name="desc"
            checked={config.specific_description === k}
            onChange={() => setField('specific_description', k)}
            label={DESC_LABELS[k]}
          />
        ))}
      </div>

      <SectionLabel>Impresión de restricciones</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(Object.keys(RESTRICTION_LABELS) as RestrictionPrintMode[]).map((k) => (
          <RadioRow
            key={k}
            name="restriction"
            checked={config.restriction_print_mode === k}
            onChange={() => setField('restriction_print_mode', k)}
            label={RESTRICTION_LABELS[k]}
          />
        ))}
      </div>

      <SectionLabel>Columnas a imprimir</SectionLabel>
      {TOGGLE_SECTIONS.map((section) => (
        <div key={section.title} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              fontSize: 'var(--aguila-fs-label)',
              color: TEXT_MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginTop: 4,
            }}
          >
            {section.title}
          </div>
          {section.keys.map((k) => (
            <label
              key={k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
                padding: '0 8px',
                cursor: 'pointer',
                color: TEXT_SECONDARY,
                fontSize: 'var(--aguila-fs-body)',
              }}
            >
              <input
                type="checkbox"
                checked={config.print_toggles[k]}
                onChange={(e) => setToggle(k, e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              {TOGGLE_LABELS[k]}
            </label>
          ))}
        </div>
      ))}

      <SectionLabel>Destinatarios de correo</SectionLabel>
      <textarea
        defaultValue={config.email_recipients.join(', ')}
        onBlur={(e) => setRecipients(e.target.value)}
        placeholder="correo@cliente.com, otro@cliente.com"
        rows={2}
        style={{
          ...selectStyle,
          resize: 'vertical',
          minHeight: 60,
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
        }}
      />
      <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED }}>
        Separa múltiples correos con coma o espacio.
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 'var(--aguila-fs-meta)',
        fontWeight: 700,
        color: TEXT_MUTED,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginTop: 8,
      }}
    >
      {children}
    </div>
  )
}

function RadioRow({
  name,
  checked,
  onChange,
  label,
}: {
  name: string
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 44,
        padding: '0 8px',
        cursor: 'pointer',
        color: TEXT_PRIMARY,
        fontSize: 'var(--aguila-fs-body)',
      }}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        style={{ width: 18, height: 18 }}
      />
      {label}
    </label>
  )
}

const selectStyle: React.CSSProperties = {
  minHeight: 44,
  padding: '0 12px',
  background: 'rgba(255,255,255,0.04)',
  color: TEXT_PRIMARY,
  border: `1px solid ${BORDER_HAIRLINE}`,
  borderRadius: 10,
  fontSize: 'var(--aguila-fs-body)',
  outline: 'none',
}

