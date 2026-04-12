/**
 * Block 3 · Dynamic Report Builder — CSV exporter.
 *
 * UTF-8 BOM for Excel compatibility. RFC 4180 quoting.
 */
import type { ColumnSpec } from '@/types/reports'

const BOM = '\uFEFF'

function escapeCell(v: unknown): string {
  if (v == null) return ''
  const s = typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function buildCsv(
  columns: readonly ColumnSpec[],
  rows: readonly Record<string, unknown>[],
): string {
  const header = columns.map((c) => escapeCell(c.label)).join(',')
  const body = rows
    .map((r) => columns.map((c) => escapeCell(r[c.key])).join(','))
    .join('\r\n')
  return BOM + header + (body ? `\r\n${body}` : '') + '\r\n'
}
