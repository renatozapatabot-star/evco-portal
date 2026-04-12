/**
 * Block 5 — Classification sheet PDF (hoja de clasificación).
 *
 * @react-pdf/renderer template. AGUILA silver header with stylized
 * geometric eagle SVG path + wordmark. Table columns are dynamic based
 * on the config's print_toggles. Footer on every page carries the
 * Patente 3596 identity + page numbers.
 */
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import { AguilaPdfHeader, AguilaPdfFooter } from '@/lib/pdf/brand'
import type {
  ClassificationSheetConfig,
  GeneratedSheet,
  GeneratedSheetMeta,
  Partida,
} from '@/types/classification'

const SILVER = '#C0C5CE'
const SILVER_BRIGHT = '#E8EAED'
const TEXT_MUTED = '#6B7280'
const TEXT_PRIMARY = '#111827'
const BORDER = '#E5E7EB'
const ZEBRA = '#F9FAFB'

const styles = StyleSheet.create({
  page: {
    padding: 28,
    paddingBottom: 56,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: TEXT_PRIMARY,
  },
  metaBlock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 8,
    borderRadius: 3,
  },
  metaItem: { width: '33%', marginBottom: 4 },
  metaLabel: {
    fontSize: 7,
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: { fontSize: 9, color: TEXT_PRIMARY, marginTop: 1 },

  table: { borderWidth: 1, borderColor: BORDER, marginBottom: 8 },
  thead: {
    flexDirection: 'row',
    backgroundColor: SILVER_BRIGHT,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  th: {
    padding: 4,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  rowZ: { backgroundColor: ZEBRA },
  td: { padding: 4, fontSize: 8, color: TEXT_PRIMARY },
  tdRight: { textAlign: 'right' },

  totals: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: SILVER,
    paddingTop: 6,
  },
  totalLabel: { fontSize: 9, color: TEXT_MUTED, marginRight: 8 },
  totalValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_PRIMARY,
  },

  warnings: {
    marginTop: 10,
    padding: 6,
    borderWidth: 0.5,
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
    borderRadius: 2,
  },
  warningTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#92400E',
    marginBottom: 3,
  },
  warningItem: { fontSize: 7, color: '#92400E', marginBottom: 1 },
})

function MetaBlock({ meta }: { meta: GeneratedSheetMeta }) {
  const items: Array<[string, string]> = [
    ['Trafico', meta.trafico_id],
    ['Cliente', meta.cliente_name],
    ['Operador', meta.operator_name],
    ['Regimen', meta.regimen ?? '—'],
    ['Tipo operacion', meta.tipo_operacion ?? '—'],
    ['Fecha', meta.generated_at],
  ]
  return (
    <View style={styles.metaBlock}>
      {items.map(([label, value]) => (
        <View key={label} style={styles.metaItem}>
          <Text style={styles.metaLabel}>{label}</Text>
          <Text style={styles.metaValue}>{value}</Text>
        </View>
      ))}
    </View>
  )
}

interface Column {
  label: string
  width: string
  get: (p: Partida) => string
  align?: 'left' | 'right'
}

function buildColumns(config: ClassificationSheetConfig): Column[] {
  const t = config.print_toggles
  const cols: Column[] = []
  if (t.print_fraction) cols.push({ label: 'Fraccion', width: '10%', get: (p) => p.fraction })
  if (t.print_description)
    cols.push({ label: 'Descripcion', width: '28%', get: (p) => truncate(p.description, 60) })
  if (t.print_umc) cols.push({ label: 'UMC', width: '6%', get: (p) => p.umc })
  if (t.print_country_origin) cols.push({ label: 'Pais', width: '6%', get: (p) => p.country })
  if (t.print_quantity)
    cols.push({
      label: 'Cantidad',
      width: '8%',
      get: (p) => p.quantity.toLocaleString('es-MX'),
      align: 'right',
    })
  if (t.print_unit_value)
    cols.push({
      label: 'Val unit',
      width: '9%',
      get: (p) => (p.unit_value !== null ? `$${p.unit_value.toFixed(2)}` : '—'),
      align: 'right',
    })
  if (t.print_total_value)
    cols.push({
      label: 'Val total',
      width: '10%',
      get: (p) => `$${p.total_value.toFixed(2)}`,
      align: 'right',
    })
  if (t.print_invoice_number)
    cols.push({ label: 'Factura', width: '8%', get: (p) => p.invoice_number ?? '—' })
  if (t.print_supplier)
    cols.push({ label: 'Proveedor', width: '10%', get: (p) => truncate(p.supplier ?? '—', 20) })
  if (t.print_tmec)
    cols.push({ label: 'T-MEC', width: '5%', get: (p) => (p.certified_tmec ? 'Si' : 'No') })
  if (t.print_marca_modelo)
    cols.push({ label: 'Marca/Modelo', width: '10%', get: (p) => p.marca_modelo ?? '—' })
  return cols
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function PartidasTable({
  sheet,
  config,
}: {
  sheet: GeneratedSheet
  config: ClassificationSheetConfig
}) {
  const cols = buildColumns(config)
  return (
    <View style={styles.table}>
      <View style={styles.thead}>
        {cols.map((c) => (
          <Text
            key={c.label}
            style={[styles.th, { width: c.width, textAlign: c.align ?? 'left' }]}
          >
            {c.label}
          </Text>
        ))}
      </View>
      {sheet.partidas.map((p, i) => (
        <View key={p.grouping_key + i} style={[styles.row, i % 2 === 1 ? styles.rowZ : {}]}>
          {cols.map((c) => (
            <Text
              key={c.label}
              style={[
                styles.td,
                { width: c.width, textAlign: c.align ?? 'left' },
                c.align === 'right' ? styles.tdRight : {},
              ]}
            >
              {c.get(p)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

function ClassificationDocument({
  sheet,
  config,
  meta,
}: {
  sheet: GeneratedSheet
  config: ClassificationSheetConfig
  meta: GeneratedSheetMeta
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <AguilaPdfHeader
          title="HOJA DE CLASIFICACION"
          subtitle={`Generada ${meta.generated_at}`}
          gradientId="silverGrad"
        />
        <MetaBlock meta={meta} />
        <PartidasTable sheet={sheet} config={config} />
        <View style={styles.totals}>
          <Text style={styles.totalLabel}>Partidas</Text>
          <Text style={styles.totalValue}>{sheet.summary.partidas_count}</Text>
          <Text style={[styles.totalLabel, { marginLeft: 20 }]}>Productos</Text>
          <Text style={styles.totalValue}>{sheet.summary.products_count}</Text>
          <Text style={[styles.totalLabel, { marginLeft: 20 }]}>Total</Text>
          <Text style={styles.totalValue}>
            ${sheet.summary.total_value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </Text>
        </View>
        {sheet.warnings.length > 0 && (
          <View style={styles.warnings}>
            <Text style={styles.warningTitle}>Advertencias</Text>
            {sheet.warnings.map((w, i) => (
              <Text key={i} style={styles.warningItem}>
                · {w}
              </Text>
            ))}
          </View>
        )}
        <AguilaPdfFooter label="AGUILA · Patente 3596 · Aduana 240 Nuevo Laredo · Año 85" />
      </Page>
    </Document>
  )
}

export async function renderClassificationPdf(
  sheet: GeneratedSheet,
  config: ClassificationSheetConfig,
  meta: GeneratedSheetMeta,
): Promise<Buffer> {
  const element = <ClassificationDocument sheet={sheet} config={config} meta={meta} />
  return await renderToBuffer(element)
}
