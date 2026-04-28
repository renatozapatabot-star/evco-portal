// CRUZ · Anexo 24 export — 13-column GlobalPC parity (2026-04-28).
//
// Renders the same Anexo24Row shape produced by `fetchAnexo24Rows`
// (src/lib/anexo24/fetchRows.ts) into XLSX + PDF. Column list comes
// from `ANEXO24_COLUMNS` (src/lib/anexo24/columns.ts) — same contract
// as the screen at `/anexo-24` and the CSV at `/api/anexo-24/csv`.
//
// Header text is the canonical client-identity block:
//   Anexo 24 — <client.nombre>
//   Patente <patente> · Aduana <aduana> · Periodo <range>
// No "(placeholder)" string. No "pendiente verificación" notice.
// Footer carries the firm identity per the design-system contract.

import React from 'react'
import * as XLSX from 'xlsx'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import { AguilaPdfHeader, AguilaPdfFooter } from '@/lib/pdf/brand'
import { ANEXO24_COLUMNS, type Anexo24Column } from '@/lib/anexo24/columns'
import type { Anexo24Row } from '@/lib/anexo24/fetchRows'
import { formatDateDMY } from '@/lib/format'

export type { Anexo24Row } from '@/lib/anexo24/fetchRows'
export { ANEXO24_COLUMNS } from '@/lib/anexo24/columns'

// Back-compat alias — older importers expect ANEXO_24_COLUMNS. Both
// names resolve to the same 13-column contract.
export const ANEXO_24_COLUMNS = ANEXO24_COLUMNS

const SILVER_BRIGHT = '#E8EAED'
const TEXT_MUTED = '#6B7280'
const TEXT_PRIMARY = '#111827'
const BORDER = '#E5E7EB'
const ZEBRA = '#F9FAFB'

export interface Anexo24Meta {
  company_id: string
  cliente_nombre: string
  date_from: string | null
  date_to: string | null
  generado_en: string
  generado_por: string
  patente: string
  aduana: string
}

export interface Anexo24Data {
  meta: Anexo24Meta
  rows: Anexo24Row[]
}

// ---------------------------------------------------------------------------
// XLSX rendering
// ---------------------------------------------------------------------------

function cellForXlsx(row: Anexo24Row, col: Anexo24Column): string | number {
  const v = row[col.key]
  if (v == null) return ''
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  return String(v)
}

function periodoLabel(meta: Anexo24Meta): string {
  if (!meta.date_from && !meta.date_to) return ''
  const from = meta.date_from ? formatDateDMY(meta.date_from) : ''
  const to = meta.date_to ? formatDateDMY(meta.date_to) : ''
  if (from && to) return `${from} a ${to}`
  return from || to
}

function buildXlsxBuffer(data: Anexo24Data): Buffer {
  const headerLabels = ANEXO24_COLUMNS.map((c) => c.header)
  const body = data.rows.map((r) => ANEXO24_COLUMNS.map((c) => cellForXlsx(r, c)))

  // Identity block — clean and quiet, no placeholder copy.
  const identityLine1 = `Anexo 24 — ${data.meta.cliente_nombre}`
  const identityLine2 = [
    `Patente ${data.meta.patente}`,
    `Aduana ${data.meta.aduana}`,
    periodoLabel(data.meta),
  ].filter(Boolean).join(' · ')

  const aoa: (string | number)[][] = [
    [identityLine1],
    [identityLine2],
    [], // spacer
    headerLabels,
    ...body,
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = ANEXO24_COLUMNS.map((c) => ({ wch: c.xlsxWidth }))

  // Merge the identity rows across the full column width.
  if (!ws['!merges']) ws['!merges'] = []
  const lastCol = ANEXO24_COLUMNS.length - 1
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } })
  ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Anexo 24')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

// ---------------------------------------------------------------------------
// PDF rendering — every column the screen + XLSX show, in landscape.
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    padding: 24,
    paddingBottom: 48,
    fontSize: 7,
    fontFamily: 'Helvetica',
    color: TEXT_PRIMARY,
  },
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
    fontSize: 6.5,
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: { fontSize: 8.5, color: TEXT_PRIMARY, marginTop: 1 },
  table: { borderWidth: 1, borderColor: BORDER, marginBottom: 8 },
  thead: {
    flexDirection: 'row',
    backgroundColor: SILVER_BRIGHT,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  th: {
    padding: 3,
    fontSize: 6,
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
  td: { padding: 3, fontSize: 6.5, color: TEXT_PRIMARY },
})

function MetaBlock({ meta, rowCount }: { meta: Anexo24Meta; rowCount: number }) {
  const items: Array<[string, string]> = [
    ['Cliente', meta.cliente_nombre],
    ['Patente', meta.patente],
    ['Aduana', meta.aduana],
    ['Periodo desde', meta.date_from ? formatDateDMY(meta.date_from) : '—'],
    ['Periodo hasta', meta.date_to ? formatDateDMY(meta.date_to) : '—'],
    ['Partidas', String(rowCount)],
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
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'number') {
    if (col.key === 'valor_usd') {
      return v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    if (col.key === 'consecutivo') return String(v)
    return v.toLocaleString('es-MX')
  }
  if (col.key === 'fecha') return formatDateDMY(String(v)) || '—'
  const str = String(v)
  if (col.key === 'descripcion' && str.length > 48) return str.slice(0, 47) + '…'
  if (str.length > 60) return str.slice(0, 59) + '…'
  return str
}

function PdfTable({ rows }: { rows: readonly Anexo24Row[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.thead} fixed>
        {ANEXO24_COLUMNS.map((c) => (
          <Text
            key={c.key}
            style={[styles.th, { width: c.pdfWidth, textAlign: c.align ?? 'left' }]}
          >
            {c.header}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={`${r.embarque}-${r.consecutivo}-${i}`} style={[styles.row, i % 2 === 1 ? styles.rowZ : {}]}>
          {ANEXO24_COLUMNS.map((c) => (
            <Text
              key={c.key}
              style={[styles.td, { width: c.pdfWidth, textAlign: c.align ?? 'left' }]}
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
      <Page size="LEGAL" orientation="landscape" style={styles.page}>
        <AguilaPdfHeader
          title={`Anexo 24 — ${data.meta.cliente_nombre}`}
          subtitle={periodoLabel(data.meta) || `Generado ${data.meta.generado_en}`}
          gradientId="silverGradAnx"
          hideEagle
        />
        <MetaBlock meta={data.meta} rowCount={data.rows.length} />
        <PdfTable rows={data.rows} />
        <AguilaPdfFooter />
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

export function buildAnexo24StoragePath(params: {
  companyId: string
  timestamp?: number
  kind: 'pdf' | 'xlsx'
}): string {
  const ts = params.timestamp ?? Date.now()
  const ext = params.kind === 'pdf' ? 'pdf' : 'xlsx'
  return `${params.companyId}/${ts}_anexo24.${ext}`
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
