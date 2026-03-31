import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const COLORS = {
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  border: '#E8E5E0',
  text: '#1A1A1A',
  textSub: '#6B6B6B',
  textMuted: '#9C9890',
  gold: '#B8953F',
  green: '#2D8540',
  amber: '#C47F17',
  red: '#C23B22',
  darkBg: '#1E1A16',
  darkGold: '#B8973A',
}

const s = StyleSheet.create({
  page: {
    backgroundColor: COLORS.bg,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLORS.text,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gold,
  },
  logoText: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.text,
    letterSpacing: 4,
  },
  logoZ: {
    color: '#CC1B2F',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerCompany: {
    fontSize: 9,
    color: COLORS.textSub,
    marginBottom: 2,
  },
  headerDate: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  // Executive sentence
  execBox: {
    backgroundColor: COLORS.darkBg,
    borderRadius: 6,
    padding: 16,
    marginBottom: 20,
  },
  execLabel: {
    fontSize: 8,
    color: COLORS.darkGold,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  },
  execText: {
    fontSize: 11,
    color: '#EAE6DC',
    lineHeight: 1.5,
  },
  // KPI row
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  kpiLabel: {
    fontSize: 7,
    color: COLORS.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  // Section
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: 10,
    marginTop: 4,
  },
  // Supplier table
  table: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F5F3EF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE4',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  thText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  tdText: {
    fontSize: 9,
    color: COLORS.text,
  },
  tdMono: {
    fontSize: 9,
    fontFamily: 'Courier',
  },
  colName: { width: '30%' },
  colNum: { width: '17.5%', textAlign: 'right' as const },
  // Compliance indicator
  complianceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: COLORS.textMuted,
  },
})

function fmtUSD(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toLocaleString('en-US')}`
}

function complianceColor(pct: number): string {
  if (pct > 80) return COLORS.green
  if (pct >= 60) return COLORS.amber
  return COLORS.red
}

interface PDFProps {
  clientName: string
  patente: string
  aduana: string
  date: string
  executiveSentence: string
  kpis: {
    totalTraficos: number
    totalValueUSD: number
    successRate: number
    avgCrossingDays: string | null
    tmecRate: number
  }
  suppliers: {
    name: string
    shipments: number
    compliancePct: number
    avgCrossDays: number | null
    tmecPct: number
  }[]
}

export function ReportesPDF(props: PDFProps) {
  const { clientName, patente, aduana, date, executiveSentence, kpis, suppliers } = props

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.logoText}>
              CRUZ<Text style={s.logoZ}> Z</Text>
            </Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerCompany}>Renato Zapata & Company</Text>
            <Text style={s.headerCompany}>Patente {patente} · Aduana {aduana}, Nuevo Laredo</Text>
            <Text style={s.headerDate}>Reporte Ejecutivo · {date}</Text>
          </View>
        </View>

        {/* Client */}
        <Text style={s.subtitle}>{clientName}</Text>

        {/* Executive sentence */}
        <View style={s.execBox}>
          <Text style={s.execLabel}>Resumen Ejecutivo</Text>
          <Text style={s.execText}>{executiveSentence}</Text>
        </View>

        {/* KPI boxes */}
        <View style={s.kpiRow}>
          <View style={s.kpiBox}>
            <Text style={[s.kpiValue, { color: COLORS.gold }]}>
              {kpis.totalTraficos.toLocaleString()}
            </Text>
            <Text style={s.kpiLabel}>Tráficos</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={[s.kpiValue, { color: COLORS.gold }]}>
              {fmtUSD(kpis.totalValueUSD)}
            </Text>
            <Text style={s.kpiLabel}>Valor USD</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={[s.kpiValue, { color: kpis.successRate >= 80 ? COLORS.green : COLORS.amber }]}>
              {kpis.successRate}%
            </Text>
            <Text style={s.kpiLabel}>Tasa Éxito</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={[s.kpiValue, { color: COLORS.text }]}>
              {kpis.avgCrossingDays ?? '—'}
            </Text>
            <Text style={s.kpiLabel}>Días Cruce</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={[s.kpiValue, { color: kpis.tmecRate >= 50 ? COLORS.green : COLORS.amber }]}>
              {kpis.tmecRate}%
            </Text>
            <Text style={s.kpiLabel}>T-MEC</Text>
          </View>
        </View>

        {/* Supplier Intelligence */}
        <Text style={s.sectionTitle}>Inteligencia de Proveedores — Top 5</Text>
        <View style={s.table}>
          <View style={s.tableHeader}>
            <View style={s.colName}><Text style={s.thText}>Proveedor</Text></View>
            <View style={s.colNum}><Text style={s.thText}>Embarques</Text></View>
            <View style={s.colNum}><Text style={s.thText}>Cumplimiento</Text></View>
            <View style={s.colNum}><Text style={s.thText}>Días Cruce</Text></View>
            <View style={s.colNum}><Text style={s.thText}>T-MEC</Text></View>
          </View>
          {suppliers.map((sup) => (
            <View key={sup.name} style={s.tableRow}>
              <View style={[s.colName, { flexDirection: 'row', alignItems: 'center' }]}>
                <View style={[s.complianceDot, { backgroundColor: complianceColor(sup.compliancePct) }]} />
                <Text style={[s.tdText, { fontFamily: 'Helvetica-Bold' }]}>{sup.name}</Text>
              </View>
              <View style={s.colNum}>
                <Text style={s.tdMono}>{sup.shipments}</Text>
              </View>
              <View style={s.colNum}>
                <Text style={[s.tdMono, { color: complianceColor(sup.compliancePct) }]}>
                  {sup.compliancePct}%
                </Text>
              </View>
              <View style={s.colNum}>
                <Text style={s.tdMono}>
                  {sup.avgCrossDays !== null ? `${sup.avgCrossDays} d` : '—'}
                </Text>
              </View>
              <View style={s.colNum}>
                <Text style={[s.tdMono, { color: sup.tmecPct >= 50 ? COLORS.green : COLORS.amber }]}>
                  {sup.tmecPct}%
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generado por CRUZ · Confidencial</Text>
          <Text style={s.footerText}>Patente {patente} · Aduana {aduana} · {date}</Text>
        </View>
      </Page>
    </Document>
  )
}
