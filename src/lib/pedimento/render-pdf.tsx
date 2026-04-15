/**
 * ZAPATA AI · V1.5 F17 — Pedimento PDF render (pure).
 *
 * Extracted so both the export route (persisted) and the preview route
 * (ephemeral, no side-effects) share one render pipeline. No I/O here.
 * Given a FullPedimento snapshot it returns PDF bytes via @react-pdf/renderer.
 *
 * Byte-stable for identical inputs (same timestamps in header come from caller).
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
import {
  AguilaPdfHeader,
  AguilaPdfFooter,
  PDF_BORDER,
  PDF_TEXT_MUTED,
  PDF_TEXT_PRIMARY,
  PDF_ZEBRA,
} from '@/lib/pdf/brand'
import type { FullPedimento } from '@/lib/pedimento-types'

const styles = StyleSheet.create({
  page: {
    padding: 28,
    paddingBottom: 56,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: PDF_TEXT_PRIMARY,
  },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: PDF_TEXT_PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_BORDER,
    paddingBottom: 3,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', marginBottom: 4 },
  label: {
    fontSize: 7,
    color: PDF_TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 9,
    color: PDF_TEXT_PRIMARY,
    fontFamily: 'Courier',
    marginTop: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_BORDER,
    paddingVertical: 3,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: PDF_ZEBRA,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: PDF_BORDER,
  },
  th: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PDF_TEXT_MUTED,
    textTransform: 'uppercase',
  },
  td: { fontSize: 8, color: PDF_TEXT_PRIMARY, paddingHorizontal: 4, fontFamily: 'Courier' },
  empty: { fontSize: 8, color: PDF_TEXT_MUTED, fontStyle: 'italic', paddingVertical: 4 },
})

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function v(s: string | null | undefined): string {
  return s && s.trim() !== '' ? s : '—'
}

interface DocProps {
  ped: FullPedimento
  generatedAt: string
}

export function PedimentoPdfDocument({ ped, generatedAt }: DocProps) {
  const parent = ped.parent
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <AguilaPdfHeader
          title="Pedimento · Vista previa"
          subtitle={`Generado ${generatedAt}`}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Encabezado</Text>
          <View style={styles.grid}>
            <View style={styles.cell}>
              <Text style={styles.label}>Pedimento</Text>
              <Text style={styles.value}>{v(parent.pedimento_number)}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>Patente</Text>
              <Text style={styles.value}>{v(parent.patente)}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>Aduana</Text>
              <Text style={styles.value}>{v(parent.aduana)}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>Régimen</Text>
              <Text style={styles.value}>{v(parent.regime_type)}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>Tipo documento</Text>
              <Text style={styles.value}>{v(parent.document_type)}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>Tipo de cambio</Text>
              <Text style={styles.value}>
                {parent.exchange_rate == null ? '—' : parent.exchange_rate.toFixed(4)}
              </Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>RFC cliente</Text>
              <Text style={styles.value}>{v(parent.cliente_rfc)}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>Origen/Destino</Text>
              <Text style={styles.value}>{v(parent.destination_origin)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partidas ({ped.partidas.length})</Text>
          {ped.partidas.length === 0 ? (
            <Text style={styles.empty}>Sin partidas capturadas</Text>
          ) : (
            <>
              <View style={styles.tableHead}>
                <Text style={[styles.th, { flex: 1.4 }]}>Fracción</Text>
                <Text style={[styles.th, { flex: 0.8 }]}>Cantidad</Text>
                <Text style={[styles.th, { flex: 0.8 }]}>Origen</Text>
                <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Valor MXN</Text>
              </View>
              {ped.partidas.slice(0, 40).map((p, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.td, { flex: 1.4 }]}>{v(p.fraccion)}</Text>
                  <Text style={[styles.td, { flex: 0.8 }]}>
                    {p.cantidad == null ? '—' : p.cantidad.toString()}
                  </Text>
                  <Text style={[styles.td, { flex: 0.8 }]}>{v(p.pais_origen)}</Text>
                  <Text style={[styles.td, { flex: 1.2, textAlign: 'right' }]}>
                    {fmtMoney(p.valor_comercial)}
                  </Text>
                </View>
              ))}
              {ped.partidas.length > 40 ? (
                <Text style={styles.empty}>
                  … {ped.partidas.length - 40} partidas adicionales no mostradas en vista previa.
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Facturas ({ped.facturas.length})</Text>
          {ped.facturas.length === 0 ? (
            <Text style={styles.empty}>Sin facturas</Text>
          ) : (
            <>
              <View style={styles.tableHead}>
                <Text style={[styles.th, { flex: 1 }]}>Número</Text>
                <Text style={[styles.th, { flex: 1.4 }]}>Proveedor</Text>
                <Text style={[styles.th, { flex: 0.8 }]}>Moneda</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Monto</Text>
              </View>
              {ped.facturas.map((f, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.td, { flex: 1 }]}>{v(f.invoice_number)}</Text>
                  <Text style={[styles.td, { flex: 1.4 }]}>{v(f.supplier_name)}</Text>
                  <Text style={[styles.td, { flex: 0.8 }]}>{v(f.currency)}</Text>
                  <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                    {fmtMoney(f.amount)}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contribuciones ({ped.contribuciones.length})</Text>
          {ped.contribuciones.length === 0 ? (
            <Text style={styles.empty}>Sin contribuciones capturadas</Text>
          ) : (
            <>
              <View style={styles.tableHead}>
                <Text style={[styles.th, { flex: 1 }]}>Tipo</Text>
                <Text style={[styles.th, { flex: 0.7, textAlign: 'right' }]}>Tasa</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Base</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Monto</Text>
              </View>
              {ped.contribuciones.map((c, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.td, { flex: 1 }]}>{v(c.contribution_type)}</Text>
                  <Text style={[styles.td, { flex: 0.7, textAlign: 'right' }]}>
                    {c.rate == null ? '—' : c.rate.toString()}
                  </Text>
                  <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                    {fmtMoney(c.base)}
                  </Text>
                  <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                    {fmtMoney(c.amount)}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        <AguilaPdfFooter />
      </Page>
    </Document>
  )
}

/**
 * Render a pedimento to PDF bytes. Pure — no DB, no storage, no logging.
 */
export async function renderPedimentoPdf(
  ped: FullPedimento,
  generatedAt: string = new Date().toISOString(),
): Promise<Buffer> {
  return renderToBuffer(<PedimentoPdfDocument ped={ped} generatedAt={generatedAt} />)
}
