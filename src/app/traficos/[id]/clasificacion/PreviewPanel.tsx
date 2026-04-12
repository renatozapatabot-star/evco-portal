'use client'

import {
  AMBER,
  BORDER_HAIRLINE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { fmtCurrency } from '@/lib/format-utils'
import type { ClassificationSheetConfig, GeneratedSheet } from '@/types/classification'

interface Props {
  sheet: GeneratedSheet
  isRefreshing: boolean
  config: ClassificationSheetConfig
}

export function PreviewPanel({ sheet, isRefreshing, config }: Props) {
  const t = config.print_toggles
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: TEXT_MUTED,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Vista previa {isRefreshing ? '· actualizando…' : ''}
        </div>
        <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
          {sheet.summary.partidas_count} partida
          {sheet.summary.partidas_count === 1 ? '' : 's'} ·{' '}
          {sheet.summary.products_count} producto
          {sheet.summary.products_count === 1 ? '' : 's'}
        </div>
      </div>

      {sheet.warnings.length > 0 && (
        <div
          style={{
            padding: 10,
            background: 'rgba(251,191,36,0.12)',
            border: `1px solid ${AMBER}44`,
            borderRadius: 8,
            fontSize: 12,
            color: TEXT_PRIMARY,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: AMBER,
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Advertencias
          </div>
          {sheet.warnings.map((w, i) => (
            <div key={i}>· {w}</div>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {t.print_fraction && <Th>Fracción</Th>}
              {t.print_description && <Th>Descripción</Th>}
              {t.print_umc && <Th>UMC</Th>}
              {t.print_country_origin && <Th>País</Th>}
              {t.print_quantity && <Th align="right">Cant.</Th>}
              {t.print_unit_value && <Th align="right">V. unit</Th>}
              {t.print_total_value && <Th align="right">V. total</Th>}
              {t.print_invoice_number && <Th>Factura</Th>}
              {t.print_supplier && <Th>Proveedor</Th>}
              {t.print_tmec && <Th>T-MEC</Th>}
              {t.print_marca_modelo && <Th>Marca/Modelo</Th>}
            </tr>
          </thead>
          <tbody>
            {sheet.partidas.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    color: TEXT_MUTED,
                    fontSize: 13,
                  }}
                >
                  No hay partidas que mostrar con la configuración actual.
                </td>
              </tr>
            )}
            {sheet.partidas.map((p, i) => (
              <tr key={p.grouping_key + i}>
                {t.print_fraction && <Td mono>{p.fraction}</Td>}
                {t.print_description && <Td>{p.description}</Td>}
                {t.print_umc && <Td>{p.umc}</Td>}
                {t.print_country_origin && <Td>{p.country}</Td>}
                {t.print_quantity && (
                  <Td mono align="right">
                    {p.quantity.toLocaleString('es-MX')}
                  </Td>
                )}
                {t.print_unit_value && (
                  <Td mono align="right">
                    {p.unit_value !== null
                      ? fmtCurrency(p.unit_value, { currency: 'USD' })
                      : '—'}
                  </Td>
                )}
                {t.print_total_value && (
                  <Td mono align="right">
                    {fmtCurrency(p.total_value, { currency: 'USD' })}
                  </Td>
                )}
                {t.print_invoice_number && <Td>{p.invoice_number ?? '—'}</Td>}
                {t.print_supplier && <Td>{p.supplier ?? '—'}</Td>}
                {t.print_tmec && <Td>{p.certified_tmec ? 'Sí' : 'No'}</Td>}
                {t.print_marca_modelo && <Td>{p.marca_modelo ?? '—'}</Td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 20,
          padding: '10px 12px',
          borderTop: `1px solid ${BORDER_HAIRLINE}`,
          marginTop: 4,
        }}
      >
        <Stat label="Partidas" value={String(sheet.summary.partidas_count)} />
        <Stat label="Productos" value={String(sheet.summary.products_count)} />
        <Stat
          label="Valor total"
          value={fmtCurrency(sheet.summary.total_value, { currency: 'USD' })}
        />
      </div>
    </div>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      style={{
        textAlign: align,
        padding: '10px 12px',
        fontSize: 11,
        fontWeight: 700,
        color: TEXT_MUTED,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        borderBottom: `1px solid ${BORDER_HAIRLINE}`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
  mono = false,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  mono?: boolean
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: '8px 12px',
        borderBottom: `1px solid ${BORDER_HAIRLINE}`,
        fontFamily: mono ? 'var(--font-mono)' : undefined,
        color: TEXT_SECONDARY,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </td>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div
        style={{
          fontSize: 10,
          color: TEXT_MUTED,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: TEXT_PRIMARY,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {value}
      </div>
    </div>
  )
}
