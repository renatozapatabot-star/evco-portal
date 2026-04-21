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
    fontSize: 21,
    lineHeight: 1.25,
    color: C.silverBright,
    marginBottom: 4,
  },
  heroEn: {
    fontSize: 10,
    color: C.silverDim,
    fontStyle: 'italic',
  },

  proofRow: {
    flexDirection: 'row',
    marginBottom: 22,
    gap: 10,
  },
  proofCell: {
    flex: 1,
    padding: 12,
    border: `0.5 solid ${C.line}`,
    borderRadius: 4,
  },
  proofNum: {
    fontFamily: 'Courier-Bold',
    fontSize: 16,
    letterSpacing: -0.5,
    color: C.silverBright,
    marginBottom: 4,
  },
  proofLabel: {
    fontSize: 8.5,
    color: C.silver,
    lineHeight: 1.35,
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
          <Text style={styles.heroKicker}>PARA {data.recipientCompany.toUpperCase()}</Text>
          <Text style={styles.heroLine}>
            85 años cruzando la frontera. Ahora con inteligencia.
          </Text>
          <Text style={styles.heroEn}>
            85 years on this border — now AI-native.
          </Text>
        </View>

        <View style={styles.proofRow}>
          <View style={styles.proofCell}>
            <Text style={styles.proofNum}>1,687</Text>
            <Text style={styles.proofLabel}>
              fracciones arancelarias ya clasificadas · 307K documentos vivos
            </Text>
          </View>
          <View style={styles.proofCell}>
            <Text style={styles.proofNum}>3.8 s</Text>
            <Text style={styles.proofLabel}>
              de email del cliente a cruce listo · demo punta a punta, 10 pasos
            </Text>
          </View>
          <View style={styles.proofCell}>
            <Text style={styles.proofNum}>16,344</Text>
            <Text style={styles.proofLabel}>
              cruces en Aduana 240 analizados · semáforo y tiempos reales
            </Text>
          </View>
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
            Contáctanos como te sea más fácil. Respondemos en menos de 4 horas hábiles.
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
            <View style={styles.ctaChannel}>
              <Text style={styles.ctaChannelLabel}>PORTAL</Text>
              <Text style={styles.ctaChannelVal}>{data.portalUrl}</Text>
            </View>
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
