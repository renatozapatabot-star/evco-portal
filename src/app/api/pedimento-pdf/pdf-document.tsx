import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { AguilaPdfHeader } from '@/lib/pdf/brand'

const C = {
  bg: '#0D1117', surface: '#161B22', border: '#30363D',
  text: '#E6EDF3', muted: '#8B949E', dim: '#484F58',
  gold: '#C0C5CE', green: '#22C55E', cyan: '#C0C5CE',
  red: '#EF4444', amber: '#F59E0B',
}

const s = StyleSheet.create({
  page: { backgroundColor: C.bg, padding: 30, fontFamily: 'Helvetica', color: C.text, fontSize: 9 },
  header: { borderBottom: `1px solid ${C.border}`, paddingBottom: 12, marginBottom: 16 },
  title: { fontSize: 16, fontWeight: 'bold', color: C.gold, marginBottom: 4 },
  subtitle: { fontSize: 9, color: C.muted },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: C.surface, borderRadius: 4, padding: 8, border: `0.5px solid ${C.border}` },
  kpiLabel: { fontSize: 7, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  kpiValue: { fontSize: 'var(--aguila-fs-section)', fontWeight: 'bold', color: C.text },
  kpiSub: { fontSize: 7, color: C.dim, marginTop: 2 },
  sectionTitle: { fontSize: 'var(--aguila-fs-label)', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 12 },
  tableHeader: { flexDirection: 'row', backgroundColor: C.surface, borderBottom: `0.5px solid ${C.border}`, paddingVertical: 4, paddingHorizontal: 6 },
  tableRow: { flexDirection: 'row', borderBottom: `0.5px solid ${C.border}`, paddingVertical: 3, paddingHorizontal: 6 },
  thText: { fontSize: 7, fontWeight: 'bold', color: C.muted, textTransform: 'uppercase' },
  tdText: { fontSize: 8, color: C.text },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: C.dim },
})

const fmtUSD = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
const fmtDate = (d: string | null) => {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Chicago' })
}

export interface PedimentoPDFProps {
  clientName: string
  patente: string
  aduana: string
  date: string
  pedimento: string
  trafico: string
  fechaPago: string | null
  fechaLlegada: string | null
  regimen: string | null
  proveedor: string
  descripcion: string
  valorUSD: number
  dta: number
  igi: number | null
  iva: number | null
  tipoCambio: number
  partidas: Array<{
    fraccion: string
    descripcion: string
    cantidad: number
    valorUSD: number
  }>
  // 'cbp'                 = DTA/IGI/IVA from AduanaNet filing data (authoritative)
  // 'estimated'           = DTA + IGI + IVA all computed from tariff_rates + system_config
  // 'estimated-partial'   = DTA computed; IGI/IVA insufficient fracción coverage
  // 'commercial-only'     = only commercial invoice synced; nothing else estimable
  dataSource: 'cbp' | 'commercial-only' | 'estimated' | 'estimated-partial'
}

export function PedimentoPDF(props: PedimentoPDFProps) {
  const valorAduana = props.valorUSD * props.tipoCambio
  const fmtOrDash = (n: number | null) => n == null ? '—' : fmtUSD(n)
  const totalContrib = (props.dta || 0) + (props.igi || 0) + (props.iva || 0)
  const hasAllContrib = props.igi != null && props.iva != null
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* ZAPATA AI brand header */}
        <AguilaPdfHeader title="Pedimento Detallado" subtitle={`${props.clientName} · Patente ${props.patente} · Aduana ${props.aduana}`} />
        <View style={s.header} fixed>
          <Text style={s.subtitle}>Generado: {props.date}</Text>
        </View>

        {/* Pedimento Info */}
        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Pedimento</Text>
            <Text style={s.kpiValue}>{props.pedimento}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Embarque</Text>
            <Text style={s.kpiValue}>{props.trafico}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Fecha Pago</Text>
            <Text style={s.kpiValue}>{fmtDate(props.fechaPago)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Régimen</Text>
            <Text style={s.kpiValue}>{props.regimen || 'A1'}</Text>
          </View>
        </View>

        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Proveedor</Text>
            <Text style={[s.kpiValue, { fontSize: 'var(--aguila-fs-label)' }]}>{props.proveedor || '—'}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Mercancía</Text>
            <Text style={[s.kpiValue, { fontSize: 'var(--aguila-fs-label)' }]}>{props.descripcion || '—'}</Text>
          </View>
        </View>

        {/* Financial Summary */}
        <Text style={s.sectionTitle}>Resumen Financiero</Text>
        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Valor Comercial USD</Text>
            <Text style={[s.kpiValue, { color: C.gold }]}>{fmtUSD(props.valorUSD)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>DTA</Text>
            <Text style={s.kpiValue}>{fmtUSD(props.dta)}</Text>
            {props.dataSource !== 'cbp' && <Text style={s.kpiSub}>Calculado</Text>}
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>IGI</Text>
            <Text style={s.kpiValue}>{fmtOrDash(props.igi)}</Text>
            {props.igi != null && props.dataSource === 'estimated' && <Text style={s.kpiSub}>Estimado</Text>}
            {props.igi == null && <Text style={s.kpiSub}>Pendiente</Text>}
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>IVA</Text>
            <Text style={s.kpiValue}>{fmtOrDash(props.iva)}</Text>
            {props.iva != null && props.dataSource === 'estimated' && <Text style={s.kpiSub}>Estimado</Text>}
            {props.iva == null && <Text style={s.kpiSub}>Pendiente</Text>}
          </View>
        </View>
        <View style={[s.kpiRow, { marginBottom: 4 }]}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Valor Aduana MXN</Text>
            <Text style={s.kpiValue}>{fmtUSD(valorAduana)}</Text>
            <Text style={s.kpiSub}>TC: {props.tipoCambio.toFixed(4)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Total Contribuciones</Text>
            <Text style={[s.kpiValue, { color: C.amber }]}>{hasAllContrib ? fmtUSD(totalContrib) : '—'}</Text>
            {!hasAllContrib && <Text style={s.kpiSub}>Pendiente sync</Text>}
          </View>
        </View>

        {/* Partidas Table */}
        {props.partidas.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Partidas ({props.partidas.length})</Text>
            <View style={s.tableHeader}>
              <Text style={[s.thText, { width: '5%' }]}>#</Text>
              <Text style={[s.thText, { width: '20%' }]}>Fracción</Text>
              <Text style={[s.thText, { width: '45%' }]}>Descripción</Text>
              <Text style={[s.thText, { width: '15%', textAlign: 'right' }]}>Cantidad</Text>
              <Text style={[s.thText, { width: '15%', textAlign: 'right' }]}>Valor USD</Text>
            </View>
            {props.partidas.map((p, i) => (
              <View key={i} style={s.tableRow} wrap={false}>
                <Text style={[s.tdText, { width: '5%', color: C.dim }]}>{i + 1}</Text>
                <Text style={[s.tdText, { width: '20%', color: C.gold }]}>{p.fraccion || '—'}</Text>
                <Text style={[s.tdText, { width: '45%' }]}>{p.descripcion?.substring(0, 60) || '—'}</Text>
                <Text style={[s.tdText, { width: '15%', textAlign: 'right' }]}>{p.cantidad || '—'}</Text>
                <Text style={[s.tdText, { width: '15%', textAlign: 'right' }]}>{p.valorUSD > 0 ? fmtUSD(p.valorUSD) : '—'}</Text>
              </View>
            ))}
          </>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>ZAPATA AI · Inteligencia aduanal · Patente {props.patente}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
