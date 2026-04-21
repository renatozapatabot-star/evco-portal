import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import {
  AguilaPdfHeader, AguilaPdfFooter,
  PDF_BORDER, PDF_TEXT_MUTED, PDF_TEXT_PRIMARY, PDF_SILVER_DIM, PDF_ZEBRA,
} from '@/lib/pdf/brand'
import type { WeeklyAuditData } from '@/lib/reports/weekly-audit'

const s = StyleSheet.create({
  page: { backgroundColor: '#FFFFFF', padding: 36, fontFamily: 'Helvetica', color: PDF_TEXT_PRIMARY, fontSize: 10 },
  h2: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: PDF_SILVER_DIM, letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 5 },
  label: { width: 120, fontSize: 9, color: PDF_TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { flex: 1, fontSize: 10, color: PDF_TEXT_PRIMARY },
  mono: { fontFamily: 'Courier' },
  kpiGrid: { flexDirection: 'row', gap: 10, marginTop: 8 },
  kpi: { flex: 1, padding: 10, borderWidth: 0.5, borderColor: PDF_BORDER, borderRadius: 4, backgroundColor: PDF_ZEBRA },
  kpiLabel: { fontSize: 8, color: PDF_TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },
  kpiValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: PDF_TEXT_PRIMARY, marginTop: 3 },
  kpiSub: { fontSize: 8, color: PDF_TEXT_MUTED, marginTop: 2 },
  table: { marginTop: 6, borderTopWidth: 0.5, borderTopColor: PDF_BORDER },
  th: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: PDF_BORDER, backgroundColor: PDF_ZEBRA },
  td: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.3, borderBottomColor: '#F3F4F6' },
  cell: { fontSize: 9, color: PDF_TEXT_PRIMARY, paddingHorizontal: 4 },
  cellHead: { fontSize: 8, color: PDF_TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 4 },
  footer: { marginTop: 24, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: PDF_BORDER },
  sigName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: PDF_TEXT_PRIMARY },
  sigTitle: { fontSize: 9, color: PDF_TEXT_MUTED, marginTop: 2 },
})

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Chicago' })
}

const fmtUSD = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD'

export interface WeeklyAuditPDFProps {
  audit: WeeklyAuditData
}

export function WeeklyAuditPDF({ audit }: WeeklyAuditPDFProps) {
  const c = audit.company
  const title = c ? `Auditoría semanal · ${c.name}` : 'Auditoría semanal'
  const subtitle = `${audit.isoWeek} · ${audit.periodFrom} → ${audit.periodTo}`

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <AguilaPdfHeader title={title} subtitle={subtitle} />

        <Text style={s.h2}>Cliente</Text>
        {c ? (
          <>
            <View style={s.row}><Text style={s.label}>Razón social</Text><Text style={s.value}>{c.name}</Text></View>
            {c.rfc && <View style={s.row}><Text style={s.label}>RFC</Text><Text style={[s.value, s.mono]}>{c.rfc}</Text></View>}
            {c.clave_cliente && <View style={s.row}><Text style={s.label}>Clave cliente</Text><Text style={[s.value, s.mono]}>{c.clave_cliente}</Text></View>}
            {c.patente && <View style={s.row}><Text style={s.label}>Patente · Aduana</Text><Text style={[s.value, s.mono]}>{c.patente} · {c.aduana ?? '—'}</Text></View>}
          </>
        ) : (
          <Text style={s.value}>Empresa no localizada en catálogo.</Text>
        )}

        <Text style={s.h2}>Resumen</Text>
        <View style={s.kpiGrid}>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Embarques</Text>
            <Text style={s.kpiValue}>{audit.traficosTotal}</Text>
            <Text style={s.kpiSub}>semana</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Pedimentos / facturas</Text>
            <Text style={s.kpiValue}>{audit.financial.facturasCount}</Text>
            <Text style={s.kpiSub}>{fmtUSD(audit.financial.facturasTotalUsd)}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>OCA firmadas</Text>
            <Text style={s.kpiValue}>{audit.documents.withOca}</Text>
            <Text style={s.kpiSub}>USMCA · {audit.documents.withUsmca}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Expedientes activos</Text>
            <Text style={s.kpiValue}>{audit.documents.totalExpedientes}</Text>
            <Text style={s.kpiSub}>documentos subidos</Text>
          </View>
        </View>

        <Text style={s.h2}>Embarques por estatus</Text>
        {audit.traficosByStatus.length === 0 ? (
          <Text style={s.value}>Sin embarques en la semana.</Text>
        ) : (
          <View style={s.table}>
            <View style={s.th}>
              <Text style={[s.cellHead, { flex: 3 }]}>Estatus</Text>
              <Text style={[s.cellHead, { flex: 1, textAlign: 'right' }]}>Cantidad</Text>
            </View>
            {audit.traficosByStatus.slice(0, 10).map((row, i) => (
              <View key={i} style={s.td}>
                <Text style={[s.cell, { flex: 3 }]}>{row.estatus}</Text>
                <Text style={[s.cell, s.mono, { flex: 1, textAlign: 'right' }]}>{row.count}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.h2}>Embarques de la semana</Text>
        {audit.traficosRows.length === 0 ? (
          <Text style={s.value}>Sin movimientos.</Text>
        ) : (
          <View style={s.table}>
            <View style={s.th}>
              <Text style={[s.cellHead, { flex: 1.3 }]}>Embarque</Text>
              <Text style={[s.cellHead, { flex: 1.8 }]}>Pedimento</Text>
              <Text style={[s.cellHead, { flex: 3 }]}>Descripción</Text>
              <Text style={[s.cellHead, { flex: 1 }]}>Estatus</Text>
              <Text style={[s.cellHead, { flex: 1, textAlign: 'right' }]}>Llegada</Text>
            </View>
            {audit.traficosRows.slice(0, 20).map((t, i) => (
              <View key={i} style={s.td}>
                <Text style={[s.cell, s.mono, { flex: 1.3 }]}>{t.trafico ?? '—'}</Text>
                <Text style={[s.cell, s.mono, { flex: 1.8 }]}>{t.pedimento ?? '—'}</Text>
                <Text style={[s.cell, { flex: 3 }]}>{(t.descripcion_mercancia ?? '—').slice(0, 80)}</Text>
                <Text style={[s.cell, { flex: 1 }]}>{t.estatus ?? '—'}</Text>
                <Text style={[s.cell, s.mono, { flex: 1, textAlign: 'right' }]}>{fmtDate(t.fecha_llegada)}</Text>
              </View>
            ))}
            {audit.traficosRows.length > 20 && (
              <Text style={[s.cellHead, { marginTop: 4 }]}>
                + {audit.traficosRows.length - 20} embarques adicionales en anexo digital
              </Text>
            )}
          </View>
        )}

        <Text style={s.h2}>Fracciones firmadas en la semana</Text>
        {audit.classifications.length === 0 ? (
          <Text style={s.value}>Sin opiniones OCA firmadas en el periodo.</Text>
        ) : (
          <View style={s.table}>
            <View style={s.th}>
              <Text style={[s.cellHead, { flex: 2 }]}>Fracción</Text>
              <Text style={[s.cellHead, { flex: 1, textAlign: 'right' }]}>OCA emitidas</Text>
            </View>
            {audit.classifications.slice(0, 15).map((c, i) => (
              <View key={i} style={s.td}>
                <Text style={[s.cell, s.mono, { flex: 2 }]}>{c.fraccion}</Text>
                <Text style={[s.cell, s.mono, { flex: 1, textAlign: 'right' }]}>{c.count}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.footer}>
          <Text style={s.sigName}>Renato Zapata III</Text>
          <Text style={s.sigTitle}>Director General · Patente 3596 · Aduana 240 · Laredo, TX</Text>
          <Text style={[s.sigTitle, { marginTop: 4 }]}>
            Reporte generado {fmtDate(audit.generatedAt)} · base cascada desde system_config
          </Text>
        </View>

        <AguilaPdfFooter />
      </Page>
    </Document>
  )
}
