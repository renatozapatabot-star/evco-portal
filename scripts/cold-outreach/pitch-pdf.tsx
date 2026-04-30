// Cold outreach pitch PDF — 1 page, silver-on-black, bilingual ES primary.
// Renders via @react-pdf/renderer · renderToBuffer() in send-campaign.ts.
// Sender identity: "Renato Zapata & Co." — never PORTAL/CRUZ/ZAPATA AI (external audience).

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// Design tokens — mirror PORTAL design system v6 (silver-on-black).
const C = {
  bg: '#0A0A0C',
  ink0: '#0A0A0C',
  silver: '#C0C5CE',
  silverBright: '#E8EAED',
  silverDim: '#7A7E86',
  line: 'rgba(192,197,206,0.18)',
  lineStrong: 'rgba(192,197,206,0.35)',
  white: '#FFFFFF',
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    color: C.silverBright,
    padding: 44,
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    lineHeight: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 16,
    borderBottom: `0.5 solid ${C.line}`,
    marginBottom: 24,
  },
  headerLeft: { flexDirection: 'column' },
  wordmark: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    letterSpacing: 2.5,
    color: C.silverBright,
    marginBottom: 3,
  },
  headerMeta: {
    fontFamily: 'Courier',
    fontSize: 7.5,
    letterSpacing: 1,
    color: C.silverDim,
  },
  headerRight: { textAlign: 'right' },
  headerRightLabel: {
    fontFamily: 'Courier',
    fontSize: 7,
    letterSpacing: 1.2,
    color: C.silverDim,
    marginBottom: 2,
  },
  headerRightVal: {
    fontFamily: 'Courier',
    fontSize: 9,
    color: C.silverBright,
  },

  hero: {
    marginBottom: 22,
  },
  heroKicker: {
    fontFamily: 'Courier',
    fontSize: 7.5,
    letterSpacing: 1.5,
    color: C.silverDim,
    marginBottom: 8,
  },
  heroLine: {
    fontSize: 22,
    lineHeight: 1.2,
    color: C.silverBright,
    marginBottom: 4,
  },
  heroAccent: {
    fontSize: 22,
    lineHeight: 1.2,
    color: C.silverBright,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  heroEn: {
    fontSize: 9.5,
    color: C.silverDim,
    fontStyle: 'italic',
    marginTop: 2,
  },

  deltaStrip: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  deltaCell: {
    flex: 1,
    padding: 12,
    border: `0.5 solid ${C.line}`,
    borderRadius: 4,
  },
  deltaLabel: {
    fontFamily: 'Courier',
    fontSize: 7,
    letterSpacing: 1.2,
    color: C.silverDim,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  deltaNum: {
    fontFamily: 'Courier-Bold',
    fontSize: 26,
    letterSpacing: -1,
    color: C.silverBright,
    marginBottom: 2,
  },
  deltaSub: {
    fontSize: 8.5,
    color: C.silver,
  },

  proofRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  proofCell: {
    flex: 1,
    padding: 10,
    border: `0.5 solid ${C.line}`,
    borderRadius: 4,
  },
  proofNum: {
    fontFamily: 'Courier-Bold',
    fontSize: 14,
    letterSpacing: -0.5,
    color: C.silverBright,
    marginBottom: 3,
  },
  proofLabel: {
    fontSize: 8,
    color: C.silver,
    lineHeight: 1.3,
  },

  quoteBlock: {
    marginBottom: 18,
    paddingLeft: 14,
    borderLeft: `1 solid ${C.lineStrong}`,
  },
  quoteText: {
    fontSize: 11,
    color: C.silverBright,
    fontStyle: 'italic',
    lineHeight: 1.45,
    marginBottom: 6,
  },
  quoteAttrib: {
    fontFamily: 'Courier',
    fontSize: 8,
    letterSpacing: 1,
    color: C.silverDim,
    textTransform: 'uppercase',
  },

  sectionTitle: {
    fontFamily: 'Courier-Bold',
    fontSize: 8,
    letterSpacing: 1.8,
    color: C.silverDim,
    marginBottom: 10,
  },
  body: {
    fontSize: 10.5,
    color: C.silverBright,
    lineHeight: 1.55,
    marginBottom: 6,
  },
  bodyDim: {
    fontSize: 9.5,
    color: C.silver,
    lineHeight: 1.5,
  },

  diffList: { marginBottom: 22 },
  diffItem: {
    flexDirection: 'row',
    marginBottom: 7,
  },
  diffBullet: {
    fontFamily: 'Courier-Bold',
    color: C.silverBright,
    fontSize: 10,
    width: 14,
  },
  diffText: {
    flex: 1,
    fontSize: 10,
    color: C.silverBright,
    lineHeight: 1.45,
  },
  diffEn: {
    fontSize: 9,
    color: C.silverDim,
    fontStyle: 'italic',
  },

  ctaBox: {
    padding: 14,
    border: `0.5 solid ${C.lineStrong}`,
    borderRadius: 4,
    marginBottom: 20,
  },
  ctaLead: {
    fontSize: 11,
    color: C.silverBright,
    marginBottom: 4,
  },
  ctaDemo: {
    fontFamily: 'Courier-Bold',
    fontSize: 13,
    color: C.silverBright,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  ctaLeadSecondary: {
    fontSize: 9.5,
    color: C.silver,
    marginBottom: 8,
  },
  ctaChannels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  ctaChannel: {
    flexDirection: 'column',
    marginRight: 16,
    marginBottom: 4,
  },
  ctaChannelLabel: {
    fontFamily: 'Courier',
    fontSize: 7.5,
    letterSpacing: 1.2,
    color: C.silverDim,
    marginBottom: 2,
  },
  ctaChannelVal: {
    fontFamily: 'Courier-Bold',
    fontSize: 10,
    color: C.silverBright,
  },

  signatureBlock: {
    marginTop: 6,
    marginBottom: 24,
  },
  signLine: {
    fontSize: 10,
    color: C.silverBright,
    marginBottom: 2,
  },
  signRole: {
    fontFamily: 'Courier',
    fontSize: 8,
    letterSpacing: 1,
    color: C.silverDim,
  },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 44,
    right: 44,
    paddingTop: 10,
    borderTop: `0.5 solid ${C.line}`,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontFamily: 'Courier',
    fontSize: 7,
    letterSpacing: 1.2,
    color: C.silverDim,
  },
})

export interface PitchData {
  recipientCompany: string
  recipientFirstName?: string
  generatedDate: string       // "19 de abril, 2026"
  opinionRef: string          // "RZC-2026-0419-NN" — one per send for audit
  portalUrl: string           // "portal.renatozapata.com"
  cta: {
    email: string
    phone?: string
    whatsapp?: string
    calendly?: string
  }
}

export function PitchPDF({ data }: { data: PitchData }) {
  return (
    <Document
      title={`Renato Zapata & Co. — ${data.recipientCompany}`}
      author="Renato Zapata & Co."
      subject="Despacho aduanal con inteligencia · Patente 3596"
      keywords="customs broker, Laredo, Patente 3596, Aduana 240"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header} fixed>
          <View style={styles.headerLeft}>
            <Text style={styles.wordmark}>RENATO ZAPATA &amp; CO.</Text>
            <Text style={styles.headerMeta}>PATENTE 3596 · ADUANA 240 · EST. 1941</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerRightLabel}>REF</Text>
            <Text style={styles.headerRightVal}>{data.opinionRef}</Text>
            <Text style={[styles.headerRightLabel, { marginTop: 4 }]}>FECHA</Text>
            <Text style={styles.headerRightVal}>{data.generatedDate}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroKicker}>
            PARA {data.recipientFirstName ? `${data.recipientFirstName.toUpperCase()} · ` : ''}
            {data.recipientCompany.toUpperCase()}
          </Text>
          <Text style={styles.heroLine}>Despacho aduanal</Text>
          <Text style={styles.heroAccent}>10× más rápido.</Text>
          <Text style={styles.heroEn}>
            Customs clearance, ten times faster — built by two people with Patente 3596.
          </Text>
        </View>

        <View style={styles.deltaStrip}>
          <View style={styles.deltaCell}>
            <Text style={styles.deltaLabel}>Antes · clasificación manual</Text>
            <Text style={styles.deltaNum}>22 min</Text>
            <Text style={styles.deltaSub}>Por SKU · Excel + WhatsApp + Word</Text>
          </View>
          <View style={styles.deltaCell}>
            <Text style={styles.deltaLabel}>Hoy · con PORTAL</Text>
            <Text style={styles.deltaNum}>2 min</Text>
            <Text style={styles.deltaSub}>Por SKU · IA + revisión de Tito + firma</Text>
          </View>
        </View>

        <View style={styles.proofRow}>
          <View style={styles.proofCell}>
            <Text style={styles.proofNum}>148,537</Text>
            <Text style={styles.proofLabel}>
              SKUs activos clasificados · catálogo EVCO
            </Text>
          </View>
          <View style={styles.proofCell}>
            <Text style={styles.proofNum}>98%</Text>
            <Text style={styles.proofLabel}>
              liberación inmediata · semáforo verde, últimos 90 días
            </Text>
          </View>
          <View style={styles.proofCell}>
            <Text style={styles.proofNum}>85 años</Text>
            <Text style={styles.proofLabel}>
              cruzando la frontera de Laredo · Patente 3596 · Est. 1941
            </Text>
          </View>
        </View>

        <View style={styles.quoteBlock}>
          <Text style={styles.quoteText}>
            &ldquo;Abro el portal a las 11 PM, veo todo en una pantalla, y me voy a dormir.
            Esto no existía antes.&rdquo;
          </Text>
          <Text style={styles.quoteAttrib}>
            Ursula Banda · Dir. de Operaciones · EVCO Plastics de México
          </Text>
        </View>

        <Text style={styles.sectionTitle}>POR QUÉ SOMOS DIFERENTES</Text>
        <View style={styles.diffList}>
          <View style={styles.diffItem}>
            <Text style={styles.diffBullet}>·</Text>
            <Text style={styles.diffText}>
              Primer broker AI-nativo en la frontera US–MX. Ocho herramientas expuestas por
              MCP para clasificación, cotización y seguimiento — sin reescribir tu ERP.
            </Text>
          </View>
          <View style={styles.diffItem}>
            <Text style={styles.diffBullet}>·</Text>
            <Text style={styles.diffText}>
              Portal en vivo para tu operación.{'  '}
              <Text style={{ fontFamily: 'Courier', color: C.silver }}>{data.portalUrl}</Text>
              {'  '}con saldos, pedimentos, expedientes y cruces — sin llamar a la oficina.
            </Text>
          </View>
          <View style={styles.diffItem}>
            <Text style={styles.diffBullet}>·</Text>
            <Text style={styles.diffText}>
              Patente 3596 propia. Dos licencias (US + MX). Dos generaciones en el mismo
              despacho. La frontera la cruza nuestra familia desde 1941.
            </Text>
          </View>
          <View style={styles.diffItem}>
            <Text style={styles.diffBullet}>·</Text>
            <Text style={styles.diffText}>
              Sin tarifas sorpresa. Cotización binding con DTA + IGI + IVA desglosados —
              no aproximaciones, no letra chica.
            </Text>
          </View>
        </View>

        <View style={styles.ctaBox}>
          <Text style={styles.ctaLead}>
            Abre el demo público — sin registro, sin email, zero compromiso:
          </Text>
          <Text style={styles.ctaDemo}>{data.portalUrl}/demo/live</Text>
          <Text style={styles.ctaLeadSecondary}>
            O contáctanos directo · respondemos en {'<'} 4 horas hábiles:
          </Text>
          <View style={styles.ctaChannels}>
            <View style={styles.ctaChannel}>
              <Text style={styles.ctaChannelLabel}>EMAIL</Text>
              <Text style={styles.ctaChannelVal}>{data.cta.email}</Text>
            </View>
            {data.cta.phone ? (
              <View style={styles.ctaChannel}>
                <Text style={styles.ctaChannelLabel}>TELÉFONO</Text>
                <Text style={styles.ctaChannelVal}>{data.cta.phone}</Text>
              </View>
            ) : null}
            {data.cta.whatsapp ? (
              <View style={styles.ctaChannel}>
                <Text style={styles.ctaChannelLabel}>WHATSAPP</Text>
                <Text style={styles.ctaChannelVal}>{data.cta.whatsapp}</Text>
              </View>
            ) : null}
            {data.cta.calendly ? (
              <View style={styles.ctaChannel}>
                <Text style={styles.ctaChannelLabel}>AGENDA 15 MIN</Text>
                <Text style={styles.ctaChannelVal}>{data.cta.calendly}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.signatureBlock}>
          <Text style={styles.signLine}>Renato Zapata III</Text>
          <Text style={styles.signRole}>DIRECTOR GENERAL · PATENTE 3596</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            PATENTE 3596 · ADUANA 240 · LAREDO TX · EST. 1941
          </Text>
          <Text style={styles.footerText}>{data.portalUrl.toUpperCase()}</Text>
        </View>
      </Page>
    </Document>
  )
}
