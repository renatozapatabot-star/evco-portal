import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const C = {
  bg: 'var(--portal-ink-2)',
  surface: 'var(--portal-fg-1)',
  border: 'var(--portal-line-1)',
  text: 'var(--portal-ink-2)',
  textSub: 'var(--portal-fg-5)',
  textMuted: 'var(--portal-fg-4)',
  gold: 'var(--portal-fg-3)',
  green: 'var(--portal-status-green-fg)',
  amber: 'var(--portal-status-amber-fg)',
  red: 'var(--portal-status-red-fg)',
  darkBg: '#1E1A16',
  darkGold: '#B8973A',
}

const s = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize: 'var(--aguila-fs-label)',
    color: C.text,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: C.gold,
  },
  logoText: {
    fontSize: 'var(--aguila-fs-kpi-mid)',
    fontFamily: 'Helvetica-Bold',
    color: C.text,
    letterSpacing: 4,
  },
  logoZ: { color: '#CC1B2F' },
  headerRight: { alignItems: 'flex-end' },
  headerCompany: { fontSize: 9, color: C.textSub, marginBottom: 2 },
  headerDate: { fontSize: 9, color: C.textMuted },
  reportTitle: {
    fontSize: 'var(--aguila-fs-section)',
    fontFamily: 'Helvetica-Bold',
    color: C.text,
    marginBottom: 4,
  },
  reportSubtitle: {
    fontSize: 'var(--aguila-fs-label)',
    color: C.textSub,
    marginBottom: 16,
  },
  execBox: {
    backgroundColor: C.darkBg,
    borderRadius: 6,
    padding: 16,
    marginBottom: 20,
  },
  execLabel: {
    fontSize: 8,
    color: C.darkGold,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  },
  execText: {
    fontSize: 'var(--aguila-fs-meta)',
    color: 'var(--portal-ink-2)',
    lineHeight: 1.5,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 'var(--aguila-fs-kpi-small)',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  kpiLabel: {
    fontSize: 7,
    color: C.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 'var(--aguila-fs-meta)',
    fontFamily: 'Helvetica-Bold',
    color: C.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: 10,
    marginTop: 4,
  },
  table: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: 'var(--portal-ink-2)',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE4',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  thText: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: C.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  tdText: { fontSize: 8, color: C.text },
  tdMono: { fontSize: 8, fontFamily: 'Courier' },
  // Column widths (total = 100%)
  colNum: { width: '4%' },
  colPed: { width: '14%' },
  colFecha: { width: '10%' },
  colFrac: { width: '10%' },
  colDesc: { width: '22%' },
  colCant: { width: '7%', textAlign: 'right' as const },
  colVal: { width: '10%', textAlign: 'right' as const },
  colProv: { width: '13%' },
  colOrigen: { width: '5%' },
  colTmec: { width: '5%' },
  truncNote: {
    fontSize: 9,
    color: C.textSub,
    textAlign: 'center' as const,
    marginTop: 12,
    fontStyle: 'italic' as const,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
  },
  footerText: { fontSize: 7, color: C.textMuted },
})

function fmtUSDCompact(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toLocaleString('es-MX')}`
}

interface Anexo24PDFProps {
  clientName: string
  patente: string
  aduana: string
  date: string
  dateRange: { from: string; to: string } | null
  totalRows: number
  truncated: boolean
  kpis: {
    totalPartidas: number
    totalValueUSD: number
    uniqueFracciones: number
    tmecPct: number
    uniqueSuppliers: number
  }
  partidas: Array<{
    rowNum: number
    pedimento: string
    fecha: string
    fraccion: string
    descripcion: string
    cantidad: number
    valorUSD: number
    proveedor: string
    origen: string
    tmec: boolean
  }>
}

export function Anexo24PDF(props: Anexo24PDFProps) {
  const { clientName, patente, aduana, date, dateRange, totalRows, truncated, kpis, partidas } = props

  const rangeLabel = dateRange
    ? `${dateRange.from} — ${dateRange.to}`
    : 'Todo el periodo disponible'

  const execSentence = `${clientName}: ${kpis.totalPartidas.toLocaleString()} partidas registradas · ${fmtUSDCompact(kpis.totalValueUSD)} USD valor total · ${kpis.uniqueFracciones} fracciones arancelarias · ${kpis.tmecPct}% operaciones T-MEC · ${kpis.uniqueSuppliers} proveedores activos.`

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.header} fixed>
          <View>
            <Text style={s.logoText}>
              CRUZ<Text style={s.logoZ}> Z</Text>
            </Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerCompany}>Renato Zapata & Company</Text>
            <Text style={s.headerCompany}>Patente {patente} · Aduana {aduana}, Nuevo Laredo</Text>
            <Text style={s.headerDate}>Reporte Anexo 24 · {date}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={s.reportTitle}>Reporte Anexo 24 — Control de Inventarios</Text>
        <Text style={s.reportSubtitle}>{clientName} · Periodo: {rangeLabel}</Text>

        {/* Executive summary */}
        <View style={s.execBox}>
          <Text style={s.execLabel}>Resumen</Text>
          <Text style={s.execText}>{execSentence}</Text>
        </View>

        {/* KPI strip */}
        <View style={s.kpiRow}>
          <View style={s.kpiBox}>
            <Text style={[s.kpiValue, { color: C.gold }]}>
              {kpis.totalPartidas.toLocaleString()}
            </Text>
            <Text style={s.kpiLabel}>Partidas</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={[s.kpiValue, { color: C.gold }]}>
              {fmtUSDCompact(kpis.totalValueUSD)} USD
            </Text>
            <Text style={s.kpiLabel}>Valor Total</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={[s.kpiValue, { color: C.text }]}>
              {kpis.uniqueFracciones}
            </Text>
            <Text style={s.kpiLabel}>Fracciones</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={[s.kpiValue, { color: kpis.tmecPct >= 50 ? C.green : C.amber }]}>
              {kpis.tmecPct}%
            </Text>
            <Text style={s.kpiLabel}>T-MEC</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={[s.kpiValue, { color: C.text }]}>
              {kpis.uniqueSuppliers}
            </Text>
            <Text style={s.kpiLabel}>Proveedores</Text>
          </View>
        </View>

        {/* Partidas table */}
        <Text style={s.sectionTitle}>Detalle de Partidas</Text>
        <View style={s.table}>
          {/* Table header */}
          <View style={s.tableHeader} fixed>
            <View style={s.colNum}><Text style={s.thText}>#</Text></View>
            <View style={s.colPed}><Text style={s.thText}>Pedimento</Text></View>
            <View style={s.colFecha}><Text style={s.thText}>Fecha</Text></View>
            <View style={s.colFrac}><Text style={s.thText}>Fracción</Text></View>
            <View style={s.colDesc}><Text style={s.thText}>Descripción</Text></View>
            <View style={s.colCant}><Text style={s.thText}>Cant.</Text></View>
            <View style={s.colVal}><Text style={s.thText}>Valor USD</Text></View>
            <View style={s.colProv}><Text style={s.thText}>Proveedor</Text></View>
            <View style={s.colOrigen}><Text style={s.thText}>Origen</Text></View>
            <View style={s.colTmec}><Text style={s.thText}>T-MEC</Text></View>
          </View>

          {/* Table rows */}
          {partidas.map((r) => (
            <View key={`${r.pedimento}-${r.rowNum}`} style={s.tableRow} wrap={false}>
              <View style={s.colNum}><Text style={s.tdMono}>{r.rowNum}</Text></View>
              <View style={s.colPed}><Text style={[s.tdMono, { fontFamily: 'Helvetica-Bold' }]}>{r.pedimento}</Text></View>
              <View style={s.colFecha}><Text style={s.tdMono}>{r.fecha || '—'}</Text></View>
              <View style={s.colFrac}><Text style={[s.tdMono, { color: C.gold }]}>{r.fraccion}</Text></View>
              <View style={s.colDesc}><Text style={s.tdText}>{r.descripcion.slice(0, 60)}</Text></View>
              <View style={s.colCant}><Text style={s.tdMono}>{r.cantidad > 0 ? r.cantidad.toLocaleString('es-MX') : '—'}</Text></View>
              <View style={s.colVal}><Text style={s.tdMono}>{r.valorUSD > 0 ? `$${r.valorUSD.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—'}</Text></View>
              <View style={s.colProv}><Text style={s.tdText}>{r.proveedor.slice(0, 30)}</Text></View>
              <View style={s.colOrigen}><Text style={s.tdText}>{r.origen}</Text></View>
              <View style={s.colTmec}><Text style={[s.tdMono, { color: r.tmec ? C.green : C.textMuted }]}>{r.tmec ? 'SI' : '—'}</Text></View>
            </View>
          ))}
        </View>

        {/* Truncation note */}
        {truncated && (
          <Text style={s.truncNote}>
            Mostrando {partidas.length.toLocaleString()} de {totalRows.toLocaleString()} partidas. Exporte CSV para el detalle completo.
          </Text>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generado por CRUZ · Confidencial</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Patente ${patente} · Aduana ${aduana} · ${date} · Pág. ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
