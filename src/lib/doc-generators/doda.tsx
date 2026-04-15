/**
 * ZAPATA AI · Block 16 — DODA (Documento de Operación para Despacho Aduanero).
 *
 * Pure generator: no I/O. Input is a pedimento-shaped record plus a minimal
 * embarque context; output is { pdf: Buffer, xml: string }.
 *
 * The XML follows SAT DODA spec conventions for the envelope, but because
 * we do not yet have the authoritative XSD handy in the repo, the emitted
 * XML carries a PLACEHOLDER comment directing verification before production
 * submission to VUCEM.
 */
import React from 'react'
import {
  Document as PdfDoc,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import { AguilaPdfHeader, AguilaPdfFooter } from '@/lib/pdf/brand'

export interface DodaInput {
  pedimento_number: string
  trafico_id: string
  company_id: string
  rfc_importador: string
  rfc_agente: string
  patente: string
  aduana: string
  fecha_pago: string | null // ISO yyyy-mm-dd
  valor_aduana_mxn: number | null
  valor_comercial_usd: number | null
  peso_bruto_kg: number | null
  tipo_operacion: 'IMP' | 'EXP'
  transporte: {
    placas: string | null
    caja: string | null
    transportista: string | null
  }
}

export interface DodaOutput {
  pdf: Buffer
  xml: string
}

export class DodaValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message)
    this.name = 'DodaValidationError'
  }
}

function validate(input: DodaInput): void {
  if (!input.pedimento_number || !/^\d{2}\s\d{2}\s\d{4}\s\d{7}$/.test(input.pedimento_number)) {
    throw new DodaValidationError('pedimento_number', 'Número de pedimento inválido (formato DD AD PPPP SSSSSSS)')
  }
  if (!input.trafico_id) throw new DodaValidationError('trafico_id', 'Embarque requerido')
  if (!input.rfc_importador) throw new DodaValidationError('rfc_importador', 'RFC del importador requerido')
  if (!input.rfc_agente) throw new DodaValidationError('rfc_agente', 'RFC del agente requerido')
  if (!input.patente) throw new DodaValidationError('patente', 'Patente requerida')
  if (!input.aduana) throw new DodaValidationError('aduana', 'Aduana requerida')
}

function xmlEscape(s: string): string {
  return s.replace(/[<>&"']/g, c =>
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '&' ? '&amp;' :
    c === '"' ? '&quot;' :
    '&apos;',
  )
}

function buildXml(input: DodaInput): string {
  const timestamp = new Date().toISOString()
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- PLACEHOLDER: verify against official SAT DODA XSD before production use -->
<DODA xmlns="http://www.sat.gob.mx/doda" version="1.0" fechaEmision="${timestamp}">
  <Pedimento numero="${xmlEscape(input.pedimento_number)}" patente="${xmlEscape(input.patente)}" aduana="${xmlEscape(input.aduana)}" tipoOperacion="${input.tipo_operacion}"/>
  <Trafico id="${xmlEscape(input.trafico_id)}" companyId="${xmlEscape(input.company_id)}"/>
  <Emisor rfc="${xmlEscape(input.rfc_agente)}"/>
  <Receptor rfc="${xmlEscape(input.rfc_importador)}"/>
  <FechaPago>${input.fecha_pago ?? ''}</FechaPago>
  <Valores>
    <ValorAduanaMXN>${input.valor_aduana_mxn ?? 0}</ValorAduanaMXN>
    <ValorComercialUSD>${input.valor_comercial_usd ?? 0}</ValorComercialUSD>
    <PesoBrutoKg>${input.peso_bruto_kg ?? 0}</PesoBrutoKg>
  </Valores>
  <Transporte>
    <Placas>${xmlEscape(input.transporte.placas ?? '')}</Placas>
    <Caja>${xmlEscape(input.transporte.caja ?? '')}</Caja>
    <Transportista>${xmlEscape(input.transporte.transportista ?? '')}</Transportista>
  </Transporte>
  <Sello algoritmo="SHA256" valor="PLACEHOLDER_SELLO"/>
</DODA>`
}

const styles = StyleSheet.create({
  page: {
    padding: 28,
    paddingBottom: 56,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#111827',
  },
  section: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 8,
    borderRadius: 3,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { width: '50%', marginBottom: 4 },
  label: {
    fontSize: 7,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: { fontSize: 10, color: '#111827', marginTop: 2 },
  banner: {
    marginBottom: 10,
    padding: 6,
    borderWidth: 0.5,
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
    borderRadius: 2,
  },
  bannerText: { fontSize: 8, color: '#92400E' },
})

function Section({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.row}>
        {items.map(([label, value]) => (
          <View key={label} style={styles.item}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value || '—'}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function DodaDocument({ input }: { input: DodaInput }) {
  const now = new Date().toISOString()
  return (
    <PdfDoc>
      <Page size="A4" style={styles.page}>
        <AguilaPdfHeader
          title="DODA"
          subtitle={`Generada ${now}`}
          gradientId="silverGradDoda"
        />
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Generación local. Submisión a VUCEM/SAT pendiente para V2.
          </Text>
        </View>
        <Section
          title="Pedimento"
          items={[
            ['Número', input.pedimento_number],
            ['Patente', input.patente],
            ['Aduana', input.aduana],
            ['Tipo operación', input.tipo_operacion],
            ['Embarque', input.trafico_id],
            ['Fecha pago', input.fecha_pago ?? '—'],
          ]}
        />
        <Section
          title="Partes"
          items={[
            ['RFC importador', input.rfc_importador],
            ['RFC agente', input.rfc_agente],
          ]}
        />
        <Section
          title="Valores"
          items={[
            ['Valor aduana (MXN)', (input.valor_aduana_mxn ?? 0).toLocaleString('es-MX')],
            ['Valor comercial (USD)', (input.valor_comercial_usd ?? 0).toLocaleString('es-MX')],
            ['Peso bruto (kg)', (input.peso_bruto_kg ?? 0).toLocaleString('es-MX')],
          ]}
        />
        <Section
          title="Transporte"
          items={[
            ['Placas', input.transporte.placas ?? '—'],
            ['Caja', input.transporte.caja ?? '—'],
            ['Transportista', input.transporte.transportista ?? '—'],
          ]}
        />
        <AguilaPdfFooter />
      </Page>
    </PdfDoc>
  )
}

export async function generateDODA(input: DodaInput): Promise<DodaOutput> {
  validate(input)
  const xml = buildXml(input)
  const pdf = await renderToBuffer(<DodaDocument input={input} />)
  return { pdf, xml }
}
