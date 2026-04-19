/**
 * Block 3 · Dynamic Report Builder — PDF exporter.
 *
 * @react-pdf/renderer template.
 *   - Header: "CRUZ" wordmark in silver mono + "Renato Zapata & Co." subtitle
 *   - Footer (every page): "Patente 3596 · Aduana 240 · Nuevo Laredo" + page number
 *   - Data table: zebra rows, truncate cells to ~40 chars
 *   - Landscape A4 by default; portrait when ≤4 columns
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
import type { ColumnSpec } from '@/types/reports'

const ACCENT_SILVER = 'var(--portal-fg-3)'
const TEXT_MUTED = 'var(--portal-fg-5)'
const TEXT_PRIMARY = 'var(--portal-ink-1)'
const BORDER = 'var(--portal-fg-2)'
const ZEBRA = 'var(--portal-fg-1)'

const styles = StyleSheet.create({
  page: {
    padding: 32,
    paddingBottom: 56,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: TEXT_PRIMARY,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 8,
  },
  brand: { flexDirection: 'column' },
  brandTitle: {
    fontSize: 18,
    fontFamily: 'Courier-Bold',
    color: ACCENT_SILVER,
    letterSpacing: 1,
  },
  brandSubtitle: { fontSize: 9, color: TEXT_MUTED, marginTop: 2 },
  meta: { flexDirection: 'column', alignItems: 'flex-end' },
  metaLine: { fontSize: 8, color: TEXT_MUTED },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  filters: { fontSize: 8, color: TEXT_MUTED, marginBottom: 10 },
  table: { borderWidth: 1, borderColor: BORDER },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  rowZebra: { backgroundColor: ZEBRA },
  headerRow: { backgroundColor: '#f3f4f6' },
  cell: { padding: 4, borderRightWidth: 1, borderRightColor: BORDER },
  headerCell: { fontWeight: 'bold', fontSize: 9 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: TEXT_MUTED,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
})

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1) + '…'
}

function cellValue(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export interface ReportPdfMeta {
  name: string
  generatedAt: string
  filtersSummary?: string
  rowCount: number
}

export async function buildPdf(
  columns: readonly ColumnSpec[],
  rows: readonly Record<string, unknown>[],
  meta: ReportPdfMeta,
): Promise<Buffer> {
  const orientation: 'portrait' | 'landscape' = columns.length <= 4 ? 'portrait' : 'landscape'
  const colCount = Math.max(columns.length, 1)
  const colWidth = `${(100 / colCount).toFixed(3)}%`

  const doc = (
    <Document>
      <Page size="A4" orientation={orientation} style={styles.page}>
        <View style={styles.header} fixed>
          <View style={styles.brand}>
            <Text style={styles.brandTitle}>PORTAL</Text>
            <Text style={styles.brandSubtitle}>Renato Zapata &amp; Co.</Text>
          </View>
          <View style={styles.meta}>
            <Text style={styles.metaLine}>{meta.generatedAt}</Text>
            <Text style={styles.metaLine}>
              {meta.rowCount} {meta.rowCount === 1 ? 'fila' : 'filas'}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{meta.name}</Text>
        {meta.filtersSummary ? (
          <Text style={styles.filters}>Filtros: {meta.filtersSummary}</Text>
        ) : null}

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]} fixed>
            {columns.map((c) => (
              <View key={c.key} style={[styles.cell, { width: colWidth }]}>
                <Text style={styles.headerCell}>{c.label}</Text>
              </View>
            ))}
          </View>
          {rows.map((r, i) => (
            <View
              key={i}
              style={[styles.row, i % 2 === 1 ? styles.rowZebra : {}]}
              wrap={false}
            >
              {columns.map((c) => (
                <View key={c.key} style={[styles.cell, { width: colWidth }]}>
                  <Text>{truncate(cellValue(r[c.key]), 40)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>Patente 3596 · Aduana 240 · Nuevo Laredo</Text>
          <Text
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )

  return renderToBuffer(doc)
}
