// CRUZ · Anexo 24 / Formato 53 export — matches the canonical GlobalPC
// Formato 53 XLSX column structure (41 columns as shipped to SAT).
//
// Reference file: the 2026-04-02 EVCO Formato 53 pull at
// /Users/renatozapataandcompany/Downloads/Anexo 24_02042026 (1).xlsx
// — column names + order copied verbatim from that file's
// sharedStrings.xml so the CRUZ export is byte-compatible with a
// SAT auditor's mental model.
//
// Not every column has source data today. Pedimento-XML-only fields
// (Secuencia, Remesa, Vinculación, Método de Valoración, FP IGI/IVA/IEPS,
// TIGI, Consignatario, Destinatario) render as empty strings —
// Formato 53 tolerates these as blanks; SAT populates them when the
// actual pedimento XML is pulled. Phase 3 ingest fills these in.

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

const SILVER = 'var(--portal-fg-3)'
const SILVER_BRIGHT = 'var(--portal-fg-1)'
const TEXT_MUTED = 'var(--portal-fg-5)'
const TEXT_PRIMARY = 'var(--portal-ink-1)'
const BORDER = 'var(--portal-fg-2)'
const ZEBRA = 'var(--portal-fg-1)'

// ---------------------------------------------------------------------------
// Types — match the 41-column Formato 53 shape.
// ---------------------------------------------------------------------------

export interface Anexo24Row {
  // Primary (always populated when data exists)
  annio_fecha_pago: string | null          // "AnnioFechaPago" — 4-digit year
  aduana: string | null                    // "Aduana"
  clave_pedimento: string | null           // "Clave" (clave de pedimento)
  fecha_pago: string | null                // "Fecha de pago" — DD/MM/YYYY
  proveedor: string | null                 // "Proveedor" — resolved name
  tax_id: string | null                    // "Tax ID/RFC"
  factura: string | null                   // "Factura" — invoice number
  fecha_factura: string | null             // "Fecha de factura" — DD/MM/YYYY
  fraccion: string | null                  // "Fracción" — XXXX.XX.XX
  numero_parte: string | null              // "Número de Parte" — cve_producto
  clave_insumo: string | null              // "Clave de Insumo" — usually numero_parte
  origen: string | null                    // "Origen" — country ISO
  tratado: string | null                   // "Tratado" — USMCA eligibility flag
  cantidad_umc: number | null              // "Cantidad UMComercial"
  umc: string | null                       // "UMComercial"
  valor_aduana: number | null              // "Valor aduana" (MXN)
  valor_comercial: number | null           // "Valor comercial" (MXN)
  tigi: string | null                      // "TIGI" — pedimento-only, nullable
  fp_igi: string | null                    // "FP IGI"
  fp_iva: string | null                    // "FP IVA"
  fp_ieps: string | null                   // "FP IEPS"
  tipo_cambio: number | null               // "Tipo de cambio"
  iva: number | null                       // "IVA"
  secuencia: number | null                 // "Secuencia" — position in pedimento
  remesa: string | null                    // "Remesa"
  marca: string | null                     // "Marca"
  modelo: string | null                    // "Modelo"
  serie: string | null                     // "Serie"
  numero_pedimento: string | null          // "Número de Pedimento" — full 15-digit
  cantidad_umt: number | null              // "Cantidad UMT"
  unidad_umt: string | null                // "Unidad UMT"
  valor_dolar: number | null               // "Valor Dólar" (USD)
  incoterm: string | null                  // "INCOTERM"
  factor_conversion: number | null         // "Factor de Conversión"
  fecha_presentacion: string | null        // "Fecha de Presentación"
  consignatario: string | null             // "Consignatario"
  destinatario: string | null              // "Destinatario"
  vinculacion: string | null               // "Vinculación"
  metodo_valoracion: string | null         // "Método de Valoración"
  peso_bruto: number | null                // "Peso bruto (kgs.)"
  pais_origen: string | null               // "País de Origen"

  // Internal only (not in the 41-col export — used by caller enrichment)
  consecutivo?: number
  tmec?: boolean
}

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
// Column definitions — order, label, width matched to Formato 53.
// ---------------------------------------------------------------------------

type ColumnKey = keyof Anexo24Row

export interface Anexo24Column {
  key: ColumnKey
  label: string
  xlsxWidth: number
  pdfWidth?: string   // only a subset rendered in the PDF
  align?: 'left' | 'right'
  pdfInclude?: boolean
}

export const ANEXO_24_COLUMNS: readonly Anexo24Column[] = [
  { key: 'annio_fecha_pago',   label: 'AnnioFechaPago',        xlsxWidth: 10, align: 'right' },
  { key: 'aduana',             label: 'Aduana',                xlsxWidth: 8,  pdfInclude: true, pdfWidth: '5%' },
  { key: 'clave_pedimento',    label: 'Clave',                 xlsxWidth: 8,  pdfInclude: true, pdfWidth: '4%' },
  { key: 'fecha_pago',         label: 'Fecha de pago',         xlsxWidth: 14, pdfInclude: true, pdfWidth: '8%' },
  { key: 'proveedor',          label: 'Proveedor',             xlsxWidth: 34, pdfInclude: true, pdfWidth: '16%' },
  { key: 'tax_id',             label: 'Tax ID/RFC',            xlsxWidth: 16 },
  { key: 'factura',            label: 'Factura',               xlsxWidth: 20, pdfInclude: true, pdfWidth: '10%' },
  { key: 'fecha_factura',      label: 'Fecha de factura',      xlsxWidth: 14 },
  { key: 'fraccion',           label: 'Fracción',              xlsxWidth: 12, pdfInclude: true, pdfWidth: '7%' },
  { key: 'numero_parte',       label: 'Número de Parte',       xlsxWidth: 18, pdfInclude: true, pdfWidth: '10%' },
  { key: 'clave_insumo',       label: 'Clave de Insumo',       xlsxWidth: 18 },
  { key: 'origen',             label: 'Origen',                xlsxWidth: 8 },
  { key: 'tratado',            label: 'Tratado',               xlsxWidth: 8 },
  { key: 'cantidad_umc',       label: 'Cantidad UMComercial',  xlsxWidth: 14, align: 'right', pdfInclude: true, pdfWidth: '6%' },
  { key: 'umc',                label: 'UMComercial',           xlsxWidth: 10, pdfInclude: true, pdfWidth: '4%' },
  { key: 'valor_aduana',       label: 'Valor aduana',          xlsxWidth: 14, align: 'right' },
  { key: 'valor_comercial',    label: 'Valor comercial',       xlsxWidth: 14, align: 'right' },
  { key: 'tigi',               label: 'TIGI',                  xlsxWidth: 8 },
  { key: 'fp_igi',             label: 'FP IGI',                xlsxWidth: 8 },
  { key: 'fp_iva',             label: 'FP IVA',                xlsxWidth: 8 },
  { key: 'fp_ieps',            label: 'FP IEPS',               xlsxWidth: 8 },
  { key: 'tipo_cambio',        label: 'Tipo de cambio',        xlsxWidth: 10, align: 'right' },
  { key: 'iva',                label: 'IVA',                   xlsxWidth: 10, align: 'right' },
  { key: 'secuencia',          label: 'Secuencia',             xlsxWidth: 8, align: 'right' },
  { key: 'remesa',             label: 'Remesa',                xlsxWidth: 10 },
  { key: 'marca',              label: 'Marca',                 xlsxWidth: 12 },
  { key: 'modelo',             label: 'Modelo',                xlsxWidth: 14 },
  { key: 'serie',              label: 'Serie',                 xlsxWidth: 16 },
  { key: 'numero_pedimento',   label: 'Número de Pedimento',   xlsxWidth: 20, pdfInclude: true, pdfWidth: '10%' },
  { key: 'cantidad_umt',       label: 'Cantidad UMT',          xlsxWidth: 12, align: 'right' },
  { key: 'unidad_umt',         label: 'Unidad UMT',            xlsxWidth: 10 },
  { key: 'valor_dolar',        label: 'Valor Dólar',           xlsxWidth: 14, align: 'right', pdfInclude: true, pdfWidth: '7%' },
  { key: 'incoterm',           label: 'INCOTERM',              xlsxWidth: 10 },
  { key: 'factor_conversion',  label: 'Factor de Conversión',  xlsxWidth: 10, align: 'right' },
  { key: 'fecha_presentacion', label: 'Fecha de Presentación', xlsxWidth: 14 },
  { key: 'consignatario',      label: 'Consignatario',         xlsxWidth: 22 },
  { key: 'destinatario',       label: 'Destinatario',          xlsxWidth: 22 },
  { key: 'vinculacion',        label: 'Vinculación',           xlsxWidth: 10 },
  { key: 'metodo_valoracion',  label: 'Método de Valoración',  xlsxWidth: 14 },
  { key: 'peso_bruto',         label: 'Peso bruto (kgs.)',     xlsxWidth: 12, align: 'right' },
  { key: 'pais_origen',        label: 'País de Origen',        xlsxWidth: 8,  pdfInclude: true, pdfWidth: '5%' },
] as const

// ---------------------------------------------------------------------------
// Excel rendering
// ---------------------------------------------------------------------------

function cellForXlsx(row: Anexo24Row, col: Anexo24Column): string | number {
  const v = row[col.key]
  if (v == null) return ''
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  return String(v)
}

function buildXlsxBuffer(data: Anexo24Data): Buffer {
  const header = ANEXO_24_COLUMNS.map((c) => c.label)
  const body = data.rows.map((r) => ANEXO_24_COLUMNS.map((c) => cellForXlsx(r, c)))

  // Header block — mirrors the real Formato 53 file which starts with a
  // two-row identity block ("Anexo 24" / client legal name) above the
  // table. SAT auditors expect this shape.
  const headerBlock: (string | number)[][] = [
    ['Anexo 24'],
    [data.meta.cliente_nombre],
    [], // spacer
    header,
  ]

  const aoa: (string | number)[][] = [...headerBlock, ...body]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = ANEXO_24_COLUMNS.map((c) => ({ wch: c.xlsxWidth }))

  // Merge the title row across the full 41-column width.
  if (!ws['!merges']) ws['!merges'] = []
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: ANEXO_24_COLUMNS.length - 1 } })
  ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: ANEXO_24_COLUMNS.length - 1 } })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Anexo 24')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

// ---------------------------------------------------------------------------
// PDF rendering — a lighter projection showing the 12 columns most useful
// for a printed audit walkthrough. The XLSX is the full 41-column truth.
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
  spacer: { fontSize: 7, color: TEXT_MUTED, marginBottom: 8 },
})

function MetaBlock({ meta, rowCount }: { meta: Anexo24Meta; rowCount: number }) {
  const items: Array<[string, string]> = [
    ['Cliente', meta.cliente_nombre],
    ['Patente', meta.patente],
    ['Aduana', meta.aduana],
    ['Periodo desde', meta.date_from ?? '—'],
    ['Periodo hasta', meta.date_to ?? '—'],
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
    if (col.key === 'valor_dolar' || col.key === 'valor_aduana' || col.key === 'valor_comercial' || col.key === 'iva') {
      return v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    return v.toLocaleString('es-MX')
  }
  const str = String(v)
  if (str.length > 40) return str.slice(0, 39) + '…'
  return str
}

function PdfTable({ rows }: { rows: readonly Anexo24Row[] }) {
  const pdfCols = ANEXO_24_COLUMNS.filter((c) => c.pdfInclude)
  return (
    <View style={styles.table}>
      <View style={styles.thead} fixed>
        {pdfCols.map((c) => (
          <Text
            key={c.key}
            style={[styles.th, { width: c.pdfWidth ?? '8%', textAlign: c.align ?? 'left' }]}
          >
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[styles.row, i % 2 === 1 ? styles.rowZ : {}]}>
          {pdfCols.map((c) => (
            <Text
              key={c.key}
              style={[styles.td, { width: c.pdfWidth ?? '8%', textAlign: c.align ?? 'left' }]}
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
          title="ANEXO 24 · FORMATO 53"
          subtitle={`Generado ${data.meta.generado_en}`}
          gradientId="silverGradAnx"
          hideEagle
        />
        <MetaBlock meta={data.meta} rowCount={data.rows.length} />
        <Text style={styles.spacer}>
          Proyección de 12 columnas — el archivo XLSX adjunto contiene las 41 columnas completas del Formato 53.
        </Text>
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
