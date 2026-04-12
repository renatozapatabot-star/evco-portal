// PLACEHOLDER Anexo 24 column structure. Verify against GlobalPC output before official use.
//
// AGUILA · Block 10 — Anexo 24 Export (structure only).
// Pure function: no I/O. Produces BOTH a PDF and an Excel Buffer from a
// single input shape. API route (`/api/reports/anexo-24/generate`) is the
// only place where storage + operational_decisions writes happen — that
// keeps this module hot-swappable when a real GlobalPC Anexo 24 sample is
// in hand.
//
// Shared AGUILA PDF header: Block 16 extracts `AguilaPdfHeader` into
// `src/lib/pdf/brand.tsx`. Until then, the header is inline-copied from
// Block 5 (`src/lib/classification-pdf.tsx`) and will be DRY'd in B16.

import React from 'react'
import * as XLSX from 'xlsx'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
  Defs,
  LinearGradient,
  Stop,
  renderToBuffer,
} from '@react-pdf/renderer'

// ---------------------------------------------------------------------------
// Silver palette — mirrors Block 5. Block 16 will import from src/lib/pdf/brand.
// ---------------------------------------------------------------------------
const SILVER = '#C0C5CE'
const SILVER_BRIGHT = '#E8EAED'
const SILVER_DIM = '#7A7E86'
const TEXT_MUTED = '#6B7280'
const TEXT_PRIMARY = '#111827'
const BORDER = '#E5E7EB'
const ZEBRA = '#F9FAFB'
const AMBER_BG = '#FEF3C7'
const AMBER_BORDER = '#F59E0B'
const AMBER_TEXT = '#92400E'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Anexo24Row {
  consecutivo: number
  pedimento: string | null
  fecha: string | null // ISO yyyy-mm-dd; PDF renders as-is, caller formats
  trafico: string | null
  fraccion: string | null
  descripcion: string | null
  cantidad: number | null
  umc: string | null
  valor_usd: number | null
  proveedor: string | null
  pais_origen: string | null
  regimen: string | null
  tmec: boolean
}

export interface Anexo24Meta {
  company_id: string
  cliente_nombre: string
  date_from: string | null
  date_to: string | null
  generado_en: string // ISO
  generado_por: string
  patente: string
  aduana: string
}

export interface Anexo24Data {
  meta: Anexo24Meta
  rows: Anexo24Row[]
}

// Column set — PLACEHOLDER. Verify against real GlobalPC Anexo 24 before use.
export interface Anexo24Column {
  key: keyof Anexo24Row
  label: string // es-MX
  width: string // PDF width %
  xlsxWidth: number // Excel column width (chars)
  align?: 'left' | 'right'
}

export const ANEXO_24_COLUMNS: readonly Anexo24Column[] = [
  { key: 'consecutivo', label: 'No.', width: '4%', xlsxWidth: 6, align: 'right' },
  { key: 'pedimento', label: 'Pedimento', width: '12%', xlsxWidth: 20 },
  { key: 'fecha', label: 'Fecha', width: '8%', xlsxWidth: 12 },
  { key: 'trafico', label: 'Tráfico', width: '8%', xlsxWidth: 14 },
  { key: 'fraccion', label: 'Fracción', width: '8%', xlsxWidth: 12 },
  { key: 'descripcion', label: 'Descripción', width: '20%', xlsxWidth: 40 },
  { key: 'cantidad', label: 'Cantidad', width: '7%', xlsxWidth: 12, align: 'right' },
  { key: 'umc', label: 'UMC', width: '4%', xlsxWidth: 8 },
  { key: 'valor_usd', label: 'Valor USD', width: '8%', xlsxWidth: 14, align: 'right' },
  { key: 'proveedor', label: 'Proveedor', width: '9%', xlsxWidth: 22 },
  { key: 'pais_origen', label: 'País', width: '5%', xlsxWidth: 8 },
  { key: 'regimen', label: 'Régimen', width: '5%', xlsxWidth: 10 },
  { key: 'tmec', label: 'T-MEC', width: '4%', xlsxWidth: 8 },
] as const

export const PLACEHOLDER_NOTICE_ES =
  'Formato Anexo 24 pendiente verificación — comparar contra muestra de GlobalPC antes de uso oficial.'

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

function formatCellForXlsx(row: Anexo24Row, col: Anexo24Column): string | number {
  const v = row[col.key]
  if (v == null) return ''
  if (col.key === 'tmec') return (v as boolean) ? 'Sí' : 'No'
  if (typeof v === 'number') return v
  return String(v)
}

function buildXlsxBuffer(data: Anexo24Data): Buffer {
  const header = ANEXO_24_COLUMNS.map(c => c.label)
  const body = data.rows.map(r => ANEXO_24_COLUMNS.map(c => formatCellForXlsx(r, c)))

  // Insert meta block rows above the table so operators see the same
  // context in both artifacts.
  const metaRows: (string | number)[][] = [
    ['AGUILA · Anexo 24 (placeholder)'],
    [PLACEHOLDER_NOTICE_ES],
    ['Cliente', data.meta.cliente_nombre],
    ['Patente', data.meta.patente, 'Aduana', data.meta.aduana],
    ['Periodo', data.meta.date_from ?? '—', 'a', data.meta.date_to ?? '—'],
    ['Generado', data.meta.generado_en, 'por', data.meta.generado_por],
    [],
  ]

  const aoa: (string | number)[][] = [...metaRows, header, ...body]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  ws['!cols'] = ANEXO_24_COLUMNS.map(c => ({ wch: c.xlsxWidth }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Anexo 24')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    padding: 28,
    paddingBottom: 56,
    fontSize: 7.5,
    fontFamily: 'Helvetica',
    color: TEXT_PRIMARY,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: SILVER,
    paddingBottom: 10,
    marginBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  wordmark: { marginLeft: 10, flexDirection: 'column' },
  brandName: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: SILVER_DIM,
    letterSpacing: 3,
  },
  brandSubtitle: { fontSize: 8, color: TEXT_MUTED, marginTop: 2 },
  headerRight: { flexDirection: 'column', alignItems: 'flex-end' },
  sheetTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_PRIMARY,
    letterSpacing: 1,
  },
  sheetDate: { fontSize: 8, color: TEXT_MUTED, marginTop: 2 },

  banner: {
    marginBottom: 10,
    padding: 6,
    borderWidth: 0.5,
    borderColor: AMBER_BORDER,
    backgroundColor: AMBER_BG,
    borderRadius: 2,
  },
  bannerText: { fontSize: 8, color: AMBER_TEXT },

  metaBlock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 6,
    borderRadius: 3,
  },
  metaItem: { width: '33%', marginBottom: 3 },
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
    padding: 3,
    fontSize: 6.5,
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
  td: { padding: 3, fontSize: 7, color: TEXT_PRIMARY },

  footer: {
    position: 'absolute',
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: TEXT_MUTED,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
})

// Inline-copied from Block 5 — Block 16 will extract into src/lib/pdf/brand.tsx.
const EAGLE_PATH =
  'M20 2 L24 8 L30 6 L26 12 L34 14 L28 18 L36 22 L28 22 L30 30 L24 26 L20 34 L16 26 L10 30 L12 22 L4 22 L12 18 L6 14 L14 12 L10 6 L16 8 Z'

function AguilaHeader({ title, date }: { title: string; date: string }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.headerLeft}>
        <Svg width={40} height={40} viewBox="0 0 40 36">
          <Defs>
            <LinearGradient id="silverGradAnx" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={SILVER_BRIGHT} />
              <Stop offset="0.5" stopColor={SILVER} />
              <Stop offset="1" stopColor={SILVER_DIM} />
            </LinearGradient>
          </Defs>
          <Path d={EAGLE_PATH} fill="url(#silverGradAnx)" stroke={SILVER_DIM} strokeWidth={0.5} />
        </Svg>
        <View style={styles.wordmark}>
          <Text style={styles.brandName}>AGUILA</Text>
          <Text style={styles.brandSubtitle}>
            Inteligencia aduanal · Patente 3596
          </Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <Text style={styles.sheetDate}>Generada {date}</Text>
      </View>
    </View>
  )
}

function AguilaFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text>AGUILA · Patente 3596 · Aduana 240 Nuevo Laredo</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Pagina ${pageNumber} / ${totalPages}`
        }
      />
    </View>
  )
}

function MetaBlock({ meta }: { meta: Anexo24Meta }) {
  const items: Array<[string, string]> = [
    ['Cliente', meta.cliente_nombre],
    ['Patente', meta.patente],
    ['Aduana', meta.aduana],
    ['Periodo desde', meta.date_from ?? '—'],
    ['Periodo hasta', meta.date_to ?? '—'],
    ['Generado por', meta.generado_por],
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

function formatCellForPdf(row: Anexo24Row, col: Anexo24Column): string {
  const v = row[col.key]
  if (v == null) return '—'
  if (col.key === 'tmec') return (v as boolean) ? 'Sí' : 'No'
  if (col.key === 'valor_usd' && typeof v === 'number') {
    return v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  if (col.key === 'cantidad' && typeof v === 'number') {
    return v.toLocaleString('es-MX')
  }
  if (typeof v === 'string' && v.length > 40) return v.slice(0, 39) + '…'
  return String(v)
}

function RowsTable({ rows }: { rows: readonly Anexo24Row[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.thead} fixed>
        {ANEXO_24_COLUMNS.map(c => (
          <Text
            key={c.key}
            style={[styles.th, { width: c.width, textAlign: c.align ?? 'left' }]}
          >
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[styles.row, i % 2 === 1 ? styles.rowZ : {}]}>
          {ANEXO_24_COLUMNS.map(c => (
            <Text
              key={c.key}
              style={[styles.td, { width: c.width, textAlign: c.align ?? 'left' }]}
            >
              {formatCellForPdf(r, c)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

function Anexo24Document({ data }: { data: Anexo24Data }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <AguilaHeader title="ANEXO 24 (PLACEHOLDER)" date={data.meta.generado_en} />
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{PLACEHOLDER_NOTICE_ES}</Text>
        </View>
        <MetaBlock meta={data.meta} />
        <RowsTable rows={data.rows} />
        <AguilaFooter />
      </Page>
    </Document>
  )
}

async function buildPdfBuffer(data: Anexo24Data): Promise<Buffer> {
  return await renderToBuffer(<Anexo24Document data={data} />)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Storage path convention. Both artifacts land under the same tenant+timestamp
 * prefix so they travel together in audits.
 */
export function buildAnexo24StoragePath(params: {
  companyId: string
  timestamp?: number
  kind: 'pdf' | 'xlsx'
}): string {
  const ts = params.timestamp ?? Date.now()
  const ext = params.kind === 'pdf' ? 'pdf' : 'xlsx'
  return `${params.companyId}/${ts}_anexo24_placeholder.${ext}`
}

export async function generateAnexo24(
  data: Anexo24Data,
): Promise<{ excel: Buffer; pdf: Buffer }> {
  const [excel, pdf] = await Promise.all([
    Promise.resolve(buildXlsxBuffer(data)),
    buildPdfBuffer(data),
  ])
  return { excel, pdf }
}
