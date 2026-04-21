/**
 * Block 3 · Dynamic Report Builder — XLSX exporter.
 *
 * Single sheet "Reporte". Bold header row. Returns a Buffer suitable for
 * streaming via NextResponse with application/vnd.openxmlformats-... mime.
 */
import * as XLSX from 'xlsx'
import type { ColumnSpec } from '@/types/reports'

export function buildXlsx(
  columns: readonly ColumnSpec[],
  rows: readonly Record<string, unknown>[],
): Buffer {
  const header = columns.map((c) => c.label)
  const body = rows.map((r) =>
    columns.map((c) => {
      const v = r[c.key]
      if (v == null) return ''
      if (typeof v === 'object') return JSON.stringify(v)
      return v as string | number | boolean
    }),
  )
  const aoa: (string | number | boolean)[][] = [header, ...body]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Autosize columns (approximate from visible length)
  ws['!cols'] = columns.map((c, idx) => {
    let max = c.label.length
    for (const row of body) {
      const cell = row[idx]
      const len = cell == null ? 0 : String(cell).length
      if (len > max) max = len
    }
    return { wch: Math.min(Math.max(max + 2, 10), 60) }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return buf
}
