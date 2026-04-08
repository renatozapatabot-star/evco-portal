import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// ── Dark theme matching EVCO Auditoría Semanal ──
const C = {
  bg: '#0F0F0E',
  surface: '#1A1918',
  surfaceLight: '#222120',
  border: '#333230',
  gold: '#C9A84C',
  goldDark: '#8B6914',
  goldMuted: '#6B5A2E',
  orange: '#E67E22',
  green: '#27AE60',
  greenDark: '#1E8449',
  red: '#E74C3C',
  text: '#E8E5DF',
  textSub: '#A09C94',
  textMuted: '#6B6860',
  white: '#FFFFFF',
}

const s = StyleSheet.create({
  page: { backgroundColor: C.bg, paddingTop: 30, paddingBottom: 40, paddingHorizontal: 36, fontFamily: 'Helvetica', fontSize: 8, color: C.text },
  // Header
  headerTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.gold, textAlign: 'center', letterSpacing: 3, textTransform: 'uppercase' as const },
  headerDate: { fontSize: 10, color: C.textSub, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerLeft: {},
  headerRight: { alignItems: 'flex-end' },
  headerLabel: { fontSize: 7, color: C.orange, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 4 },
  headerCompany: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.text },
  headerSub: { fontSize: 8, color: C.textSub, marginTop: 2 },
  headerInfo: { fontSize: 7, color: C.textMuted, marginTop: 1 },
  // KPI strip
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  kpiCard: { flex: 1, backgroundColor: C.surface, borderRadius: 4, padding: 12, borderWidth: 1, borderColor: C.border },
  kpiLabel: { fontSize: 7, color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  kpiValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.text, marginTop: 4 },
  kpiSub: { fontSize: 7, color: C.textSub, marginTop: 2 },
  // Section headers
  sectionTitle: { fontSize: 9, color: C.orange, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' as const, marginTop: 16, marginBottom: 8 },
  // Table
  tableHeader: { flexDirection: 'row', backgroundColor: C.surfaceLight, paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  tableHeaderCell: { fontSize: 7, color: C.textMuted, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tableCell: { fontSize: 7.5, color: C.text },
  tableCellMono: { fontSize: 7.5, color: C.text, fontFamily: 'Courier' },
  tableCellGreen: { fontSize: 7.5, color: C.green, fontFamily: 'Courier-Bold' },
  tableCellGold: { fontSize: 7.5, color: C.gold, fontFamily: 'Courier' },
  // Totals row
  totalsRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4, backgroundColor: C.surfaceLight, borderTopWidth: 1, borderTopColor: C.gold },
  totalsLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.textSub },
  totalsValue: { fontSize: 8, fontFamily: 'Courier-Bold', color: C.gold },
  // Pedimento group header
  pedGroupHeader: { backgroundColor: '#1A2520', paddingVertical: 4, paddingHorizontal: 6, marginTop: 8, borderRadius: 2 },
  pedGroupText: { fontSize: 7, color: C.orange, fontFamily: 'Helvetica-Bold' },
  // Status badge
  badgeOK: { fontSize: 6, color: C.white, backgroundColor: C.green, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 2 },
  // Entrada row
  entradaDay: { backgroundColor: '#1A2520', paddingVertical: 3, paddingHorizontal: 6, marginTop: 6, borderRadius: 2 },
  entradaDayText: { fontSize: 7, color: C.orange, fontFamily: 'Helvetica-Bold' },
  // Fraccion card
  fraccionCard: { backgroundColor: C.surface, borderRadius: 4, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  fraccionTitle: { fontSize: 10, color: C.gold, fontFamily: 'Courier-Bold' },
  fraccionDesc: { fontSize: 7.5, color: C.text, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  fraccionSub: { fontSize: 7, color: C.textMuted, marginTop: 1 },
  fraccionValue: { fontSize: 8, color: C.green, fontFamily: 'Courier-Bold', marginTop: 4 },
  // Footer
  footer: { position: 'absolute' as const, bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6 },
  footerText: { fontSize: 6, color: C.textMuted },
})

function fmtUSD(n: number) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtMXN(n: number) { return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtNum(n: number) { return n.toLocaleString('es-MX') }
function fmtDateShort(d: string) { return d ? d.split('T')[0].split('-').reverse().join('/') : '—' }

const DAYS_ES: Record<string, string> = { '0': 'Domingo', '1': 'Lunes', '2': 'Martes', '3': 'Miércoles', '4': 'Jueves', '5': 'Viernes', '6': 'Sábado' }
function dayLabel(dateStr: string) {
  const dt = new Date(dateStr + 'T12:00:00')
  return DAYS_ES[String(dt.getDay())] || ''
}

interface AuditData {
  from: string; to: string; dateRangeLabel: string; dateRangeLong: string
  reportTitle?: string; reportSubtitle?: string
  clientName: string; clientClave: string; clientRFC: string; emittedDate: string
  totalValorUSD: number; pedimentoCount: number; traficosListStr: string
  remesaCount: number; totalPeso: number; totalBultos: number; incidencias: number
  pedimentos: Array<{
    trafico: string; pedimento: string; clave: string; regimen: string
    fechaPago: string | null; tc: number; valorUSD: number
    dtaMXN: number; igiMXN: number; ivaMXN: number; totalGravamen: number; estatus: string
  }>
  totalDTA: number; totalIGI: number; totalIVA: number; totalGravamen: number
  supplierDetail: Array<{
    pedimentoHeader: string
    rows: Array<{
      trafico: string; pedimento: string; fechaPago: string; fechaCruce: string
      proveedor: string; factura: string; cove: string; valorUSD: number
      transpMX: string; transpExt: string; estatus: string
    }>
  }>
  entradasByDay: Array<{ day: string; entradas: Array<Record<string, unknown>> }>
  fracciones: Array<{ fraccion: string; valorUSD: number; count: number; pedimentos: string[] }>
}

export function AuditoriaPDF({ data }: { data: AuditData }) {
  const d = data
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* ── HEADER ── */}
        <Text style={s.headerTitle}>{d.reportTitle || 'AUDITORÍA SEMANAL'}</Text>
        <Text style={s.headerDate}>{d.dateRangeLong}</Text>

        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <Text style={s.headerLabel}>{d.reportTitle || 'AUDITORÍA SEMANAL'} DE IMPORTACIONES</Text>
            <Text style={s.headerCompany}>{d.reportSubtitle || `Reporte de Embarques — Semana ${d.dateRangeLabel}`}</Text>
            <Text style={s.headerSub}>Preparado por Grupo Aduanal Renato Zapata S.C. · Patente 3596 · Aduana 240 Nuevo Laredo</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={{ ...s.headerCompany, fontSize: 10 }}>{d.clientName}</Text>
            <Text style={s.headerInfo}>RFC: {d.clientRFC} · Clave: {d.clientClave}</Text>
            <Text style={s.headerInfo}>Período: {fmtDateShort(d.from)} – {fmtDateShort(d.to)} · Emitido: {d.emittedDate}</Text>
          </View>
        </View>

        {/* ── KPI STRIP ── */}
        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Valor Total Importado</Text>
            <Text style={s.kpiValue}>{fmtUSD(d.totalValorUSD)} USD</Text>
            <Text style={s.kpiSub}>{d.pedimentoCount} pedimentos</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Tráficos Cruzados</Text>
            <Text style={s.kpiValue}>{d.pedimentoCount}</Text>
            <Text style={s.kpiSub}>{d.traficosListStr || '—'}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Remesas Cruzadas</Text>
            <Text style={s.kpiValue}>{d.remesaCount}</Text>
            <Text style={s.kpiSub}>{fmtNum(d.totalPeso)} kg recibidos</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Incidencias Aduaneras</Text>
            <Text style={{ ...s.kpiValue, color: d.incidencias === 0 ? C.green : C.red }}>{d.incidencias}</Text>
            <Text style={s.kpiSub}>{d.incidencias === 0 ? 'Sin multas · Sin observaciones' : `${d.incidencias} observación(es)`}</Text>
          </View>
        </View>

        {/* ── SECTION I: RESUMEN FINANCIERO ── */}
        <Text style={s.sectionTitle}>I. Resumen Financiero de Pedimentos</Text>

        <View style={s.tableHeader}>
          <Text style={{ ...s.tableHeaderCell, width: 55 }}>Tráfico</Text>
          <Text style={{ ...s.tableHeaderCell, width: 50 }}>Pedimento</Text>
          <Text style={{ ...s.tableHeaderCell, width: 30 }}>Clave</Text>
          <Text style={{ ...s.tableHeaderCell, width: 55 }}>Régimen</Text>
          <Text style={{ ...s.tableHeaderCell, width: 50 }}>Fecha Pago</Text>
          <Text style={{ ...s.tableHeaderCell, width: 30 }}>T/C</Text>
          <Text style={{ ...s.tableHeaderCell, width: 55, textAlign: 'right' }}>Valor USD</Text>
          <Text style={{ ...s.tableHeaderCell, width: 50, textAlign: 'right' }}>DTA (MXN)</Text>
          <Text style={{ ...s.tableHeaderCell, width: 50, textAlign: 'right' }}>IGI (MXN)</Text>
          <Text style={{ ...s.tableHeaderCell, width: 55, textAlign: 'right' }}>IVA (MXN)</Text>
          <Text style={{ ...s.tableHeaderCell, width: 55, textAlign: 'right' }}>Total Gravamen</Text>
          <Text style={{ ...s.tableHeaderCell, width: 35, textAlign: 'center' }}>Estatus</Text>
        </View>

        {d.pedimentos.map((p, i) => (
          <View key={i} style={s.tableRow}>
            <Text style={{ ...s.tableCellMono, width: 55 }}>{p.trafico}</Text>
            <Text style={{ ...s.tableCellMono, width: 50 }}>{p.pedimento.replace(/^\d{2}\s\d{2}\s\d{4}\s/, '')}</Text>
            <Text style={{ ...s.tableCellGold, width: 30 }}>{p.clave}</Text>
            <Text style={{ ...s.tableCell, width: 55 }}>{p.regimen}</Text>
            <Text style={{ ...s.tableCellMono, width: 50 }}>{fmtDateShort(p.fechaPago || '')}</Text>
            <Text style={{ ...s.tableCellMono, width: 30 }}>{p.tc.toFixed(4)}</Text>
            <Text style={{ ...s.tableCellGreen, width: 55, textAlign: 'right' }}>{fmtUSD(p.valorUSD)}</Text>
            <Text style={{ ...s.tableCellMono, width: 50, textAlign: 'right' }}>{fmtMXN(p.dtaMXN)}</Text>
            <Text style={{ ...s.tableCellMono, width: 50, textAlign: 'right' }}>{fmtMXN(p.igiMXN)}</Text>
            <Text style={{ ...s.tableCellMono, width: 55, textAlign: 'right' }}>{fmtMXN(p.ivaMXN)}</Text>
            <Text style={{ ...s.tableCellMono, width: 55, textAlign: 'right' }}>{fmtMXN(p.totalGravamen)}</Text>
            <View style={{ width: 35, alignItems: 'center' }}>
              <Text style={s.badgeOK}>✓ OK</Text>
            </View>
          </View>
        ))}

        {/* Totals */}
        <View style={s.totalsRow}>
          <Text style={{ ...s.totalsLabel, width: 270 }}>TOTALES</Text>
          <Text style={{ ...s.totalsValue, width: 55, textAlign: 'right' }}>{fmtUSD(d.totalValorUSD)}</Text>
          <Text style={{ ...s.totalsValue, width: 50, textAlign: 'right' }}>{fmtMXN(d.totalDTA)}</Text>
          <Text style={{ ...s.totalsValue, width: 50, textAlign: 'right' }}>{fmtMXN(d.totalIGI)}</Text>
          <Text style={{ ...s.totalsValue, width: 55, textAlign: 'right' }}>{fmtMXN(d.totalIVA)}</Text>
          <Text style={{ ...s.totalsValue, width: 55, textAlign: 'right' }}>{fmtMXN(d.totalGravamen)}</Text>
          <Text style={{ width: 35 }}> </Text>
        </View>

        {/* ── SECTION II: DETALLE POR PROVEEDOR ── */}
        <Text style={s.sectionTitle}>II. Detalle de Pedimentos por Proveedor</Text>

        {d.supplierDetail.map((group, gi) => (
          <View key={gi}>
            <View style={s.pedGroupHeader}>
              <Text style={s.pedGroupText}>{group.pedimentoHeader}</Text>
            </View>
            <View style={s.tableHeader}>
              <Text style={{ ...s.tableHeaderCell, width: 55 }}>Tráfico</Text>
              <Text style={{ ...s.tableHeaderCell, width: 50 }}>Pedimento</Text>
              <Text style={{ ...s.tableHeaderCell, width: 50 }}>Fecha Pago</Text>
              <Text style={{ ...s.tableHeaderCell, width: 50 }}>Fecha Cruce</Text>
              <Text style={{ ...s.tableHeaderCell, width: 80 }}>Proveedor(s)</Text>
              <Text style={{ ...s.tableHeaderCell, width: 55 }}>Factura(s)</Text>
              <Text style={{ ...s.tableHeaderCell, width: 70 }}>COVE</Text>
              <Text style={{ ...s.tableHeaderCell, width: 45, textAlign: 'right' }}>Valor USD</Text>
              <Text style={{ ...s.tableHeaderCell, width: 35, textAlign: 'center' }}>Estatus</Text>
            </View>
            {group.rows.map((row, ri) => (
              <View key={ri} style={s.tableRow}>
                <Text style={{ ...s.tableCellMono, width: 55 }}>{row.trafico}</Text>
                <Text style={{ ...s.tableCellMono, width: 50 }}>{row.pedimento.replace(/^\d{2}\s\d{2}\s\d{4}\s/, '')}</Text>
                <Text style={{ ...s.tableCellGold, width: 50 }}>{fmtDateShort(row.fechaPago)}</Text>
                <Text style={{ ...s.tableCellGold, width: 50 }}>{fmtDateShort(row.fechaCruce)}</Text>
                <Text style={{ ...s.tableCell, width: 80, fontSize: 6.5 }}>{row.proveedor}</Text>
                <Text style={{ ...s.tableCellMono, width: 55, fontSize: 6 }}>{row.factura}</Text>
                <Text style={{ ...s.tableCellMono, width: 70, fontSize: 6 }}>{row.cove}</Text>
                <Text style={{ ...s.tableCellGreen, width: 45, textAlign: 'right' }}>{row.valorUSD > 0 ? fmtUSD(row.valorUSD) : '—'}</Text>
                <View style={{ width: 35, alignItems: 'center' }}>
                  <Text style={s.badgeOK}>✓ OK</Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        {/* Total valor */}
        <View style={{ ...s.totalsRow, marginTop: 4 }}>
          <Text style={{ ...s.totalsLabel, flex: 1, textAlign: 'right', paddingRight: 8 }}>TOTAL VALOR IMPORTADO</Text>
          <Text style={s.totalsValue}>{fmtUSD(d.totalValorUSD)}</Text>
        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Preparado por: Grupo Aduanal Renato Zapata S.C. · Patente 3596 · Aduana 240 Nuevo Laredo</Text>
          <Text style={s.footerText}>Para: {d.clientName} · RFC: {d.clientRFC} · Documento Confidencial · {d.emittedDate}</Text>
        </View>
      </Page>

      {/* ── PAGE 2: REMESAS + FRACCIONES ── */}
      <Page size="LETTER" style={s.page}>
        {/* ── SECTION III: REMESAS CRUZADAS ── */}
        <Text style={s.sectionTitle}>III. Remesas Cruzadas — {d.clientName} #{d.clientClave}</Text>

        <View style={s.tableHeader}>
          <Text style={{ ...s.tableHeaderCell, width: 20 }}>#</Text>
          <Text style={{ ...s.tableHeaderCell, width: 45 }}>Entrada</Text>
          <Text style={{ ...s.tableHeaderCell, width: 35 }}>Fecha</Text>
          <Text style={{ ...s.tableHeaderCell, width: 160 }}>Descripción Mercancía</Text>
          <Text style={{ ...s.tableHeaderCell, width: 50 }}># Pedido</Text>
          <Text style={{ ...s.tableHeaderCell, width: 35, textAlign: 'right' }}>Bultos</Text>
          <Text style={{ ...s.tableHeaderCell, width: 50, textAlign: 'right' }}>Peso</Text>
          <Text style={{ ...s.tableHeaderCell, width: 50, textAlign: 'right' }}>Valor USD</Text>
          <Text style={{ ...s.tableHeaderCell, width: 35, textAlign: 'center' }}>Estatus</Text>
        </View>

        {d.entradasByDay.map((dayGroup, di) => {
          const dayEntradas = dayGroup.entradas
          return (
            <View key={di}>
              <View style={s.entradaDay}>
                <Text style={s.entradaDayText}>
                  {dayLabel(dayGroup.day)} {fmtDateShort(dayGroup.day)} — {dayEntradas.length} remesa{dayEntradas.length !== 1 ? 's' : ''}
                </Text>
              </View>
              {dayEntradas.map((e, ei) => {
                const globalIdx = d.entradasByDay.slice(0, di).reduce((s, g) => s + g.entradas.length, 0) + ei + 1
                return (
                  <View key={ei} style={s.tableRow}>
                    <Text style={{ ...s.tableCellMono, width: 20 }}>{String(globalIdx).padStart(2, '0')}</Text>
                    <Text style={{ ...s.tableCellMono, width: 45 }}>{String(e.cve_entrada || '')}</Text>
                    <Text style={{ ...s.tableCellMono, width: 35 }}>{fmtDateShort(String(e.fecha_llegada_mercancia || ''))}</Text>
                    <Text style={{ ...s.tableCell, width: 160, fontSize: 6.5 }}>{String(e.descripcion_mercancia || '').substring(0, 50)}</Text>
                    <Text style={{ ...s.tableCellMono, width: 50 }}>{String(e.num_pedido || '')}</Text>
                    <Text style={{ ...s.tableCellMono, width: 35, textAlign: 'right' }}>{Number(e.cantidad_bultos) || '—'}</Text>
                    <Text style={{ ...s.tableCellMono, width: 50, textAlign: 'right' }}>{Number(e.peso_bruto) ? `${fmtNum(Number(e.peso_bruto))} kg` : '—'}</Text>
                    <Text style={{ ...s.tableCellMono, width: 50, textAlign: 'right' }}>—</Text>
                    <View style={{ width: 35, alignItems: 'center' }}>
                      <Text style={s.badgeOK}>✓ OK</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          )
        })}

        {/* Totals */}
        <View style={{ ...s.totalsRow, marginTop: 4 }}>
          <Text style={{ ...s.totalsLabel, width: 310 }}>TOTALES</Text>
          <Text style={{ ...s.totalsValue, width: 35, textAlign: 'right' }}>{d.totalBultos} bts</Text>
          <Text style={{ ...s.totalsValue, width: 50, textAlign: 'right' }}>{fmtNum(d.totalPeso)} kg</Text>
          <Text style={{ ...s.totalsValue, width: 50, textAlign: 'right' }}>{fmtUSD(d.totalValorUSD)}</Text>
          <Text style={{ ...s.totalsLabel, width: 35, textAlign: 'center' }}>{d.remesaCount} remesas</Text>
        </View>

        {/* ── SECTION IV: FRACCIONES ── */}
        <Text style={s.sectionTitle}>IV. Fracciones Arancelarias Utilizadas</Text>

        {d.fracciones.map((f, fi) => (
          <View key={fi} style={s.fraccionCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={s.fraccionTitle}>{f.fraccion}</Text>
                <Text style={s.fraccionSub}>{f.count} uso{f.count !== 1 ? 's' : ''} históricos</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.fraccionValue}>{fmtUSD(f.valorUSD)} USD</Text>
              </View>
            </View>
            {f.pedimentos.slice(0, 3).map((ped, pi) => (
              <Text key={pi} style={{ ...s.tableCellMono, fontSize: 6.5, marginTop: 2, color: C.textSub }}>{ped}</Text>
            ))}
          </View>
        ))}

        {/* ── FOOTER ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Preparado por: Grupo Aduanal Renato Zapata S.C. · Patente 3596 · Aduana 240 Nuevo Laredo</Text>
          <Text style={s.footerText}>Para: {d.clientName} · RFC: {d.clientRFC} · Documento Confidencial · {d.emittedDate}</Text>
        </View>
      </Page>
    </Document>
  )
}
