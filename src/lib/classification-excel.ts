/**
 * Block 5 — Classification sheet XLSX exporter.
 *
 * Single sheet "Hoja de clasificacion" — designed to open cleanly in
 * AduanaNet M3. Headers match the PDF column set exactly so the two
 * exports stay in sync.
 */
import * as XLSX from 'xlsx'
import type {
  ClassificationSheetConfig,
  GeneratedSheet,
  Partida,
} from '@/types/classification'

interface Col {
  label: string
  get: (p: Partida) => string | number
}

function buildCols(config: ClassificationSheetConfig): Col[] {
  const t = config.print_toggles
  const cols: Col[] = []
  if (t.print_fraction) cols.push({ label: 'Fraccion', get: (p) => p.fraction })
  if (t.print_description) cols.push({ label: 'Descripcion', get: (p) => p.description })
  if (t.print_umc) cols.push({ label: 'UMC', get: (p) => p.umc })
  if (t.print_country_origin) cols.push({ label: 'Pais origen', get: (p) => p.country })
  if (t.print_quantity) cols.push({ label: 'Cantidad', get: (p) => p.quantity })
  if (t.print_unit_value)
    cols.push({ label: 'Valor unitario', get: (p) => p.unit_value ?? '' })
  if (t.print_total_value) cols.push({ label: 'Valor total', get: (p) => p.total_value })
  if (t.print_invoice_number)
    cols.push({ label: 'Factura', get: (p) => p.invoice_number ?? '' })
  if (t.print_supplier) cols.push({ label: 'Proveedor', get: (p) => p.supplier ?? '' })
  if (t.print_tmec) cols.push({ label: 'T-MEC', get: (p) => (p.certified_tmec ? 'Si' : 'No') })
  if (t.print_marca_modelo)
    cols.push({ label: 'Marca/Modelo', get: (p) => p.marca_modelo ?? '' })
  return cols
}

export function buildClassificationXlsx(
  sheet: GeneratedSheet,
  config: ClassificationSheetConfig,
): Buffer {
  const cols = buildCols(config)
  const header = cols.map((c) => c.label)
  const body: (string | number)[][] = sheet.partidas.map((p) =>
    cols.map((c) => {
      const v = c.get(p)
      return typeof v === 'number' ? v : String(v ?? '')
    }),
  )

  // Totals row
  const totalsRow: (string | number)[] = cols.map((c, idx) => {
    if (idx === 0) return 'TOTALES'
    if (c.label === 'Cantidad')
      return sheet.partidas.reduce((s, p) => s + p.quantity, 0)
    if (c.label === 'Valor total') return sheet.summary.total_value
    return ''
  })

  const aoa: (string | number)[][] = [header, ...body, [], totalsRow]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  ws['!cols'] = cols.map((c) => {
    let max = c.label.length
    for (const row of body) {
      const cell = row[cols.indexOf(c)]
      const len = cell == null ? 0 : String(cell).length
      if (len > max) max = len
    }
    return { wch: Math.min(Math.max(max + 2, 10), 50) }
  })

  // Make header bold
  for (let i = 0; i < cols.length; i++) {
    const ref = XLSX.utils.encode_cell({ c: i, r: 0 })
    if (ws[ref]) {
      ws[ref].s = { font: { bold: true } }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja de clasificacion')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return buf
}
