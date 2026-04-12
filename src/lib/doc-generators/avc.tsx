/**
 * AGUILA · Block 16 — AVC (Aviso de Cruce).
 *
 * Pure generator: no I/O. Input is a warehouse_entry-shaped record; output
 * is { pdf, xml }. XSD convention comes from SAT public documentation; until
 * pinned, the emitted XML carries a PLACEHOLDER comment.
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

export interface AvcInput {
  warehouse_entry_id: string
  trafico_id: string
  company_id: string
  trailer_number: string
  dock_assigned: string | null
  received_by: string
  received_at: string // ISO 8601
  photo_count: number
  notes?: string | null
  rfc_importador: string
  patente: string
  aduana: string
}

export interface AvcOutput {
  pdf: Buffer
  xml: string
}

export class AvcValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message)
    this.name = 'AvcValidationError'
  }
}

function validate(input: AvcInput): void {
  if (!input.warehouse_entry_id) throw new AvcValidationError('warehouse_entry_id', 'ID de entrada requerido')
  if (!input.trafico_id) throw new AvcValidationError('trafico_id', 'Tráfico requerido')
  if (!input.trailer_number) throw new AvcValidationError('trailer_number', 'Número de caja requerido')
  if (!input.received_by) throw new AvcValidationError('received_by', 'Receptor requerido')
  if (!input.received_at) throw new AvcValidationError('received_at', 'Fecha de recepción requerida')
  if (!input.rfc_importador) throw new AvcValidationError('rfc_importador', 'RFC del importador requerido')
  if (!input.patente) throw new AvcValidationError('patente', 'Patente requerida')
  if (!input.aduana) throw new AvcValidationError('aduana', 'Aduana requerida')
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

function buildXml(input: AvcInput): string {
  const timestamp = new Date().toISOString()
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- PLACEHOLDER: verify against official SAT AVC XSD before production use -->
<AVC xmlns="http://www.sat.gob.mx/avc" version="1.0" fechaEmision="${timestamp}">
  <EntradaBodega id="${xmlEscape(input.warehouse_entry_id)}" companyId="${xmlEscape(input.company_id)}"/>
  <Trafico id="${xmlEscape(input.trafico_id)}"/>
  <Importador rfc="${xmlEscape(input.rfc_importador)}"/>
  <Patente numero="${xmlEscape(input.patente)}" aduana="${xmlEscape(input.aduana)}"/>
  <Recepcion>
    <FechaHora>${xmlEscape(input.received_at)}</FechaHora>
    <Receptor>${xmlEscape(input.received_by)}</Receptor>
    <Caja>${xmlEscape(input.trailer_number)}</Caja>
    <Dock>${xmlEscape(input.dock_assigned ?? '')}</Dock>
  </Recepcion>
  <Evidencia fotos="${input.photo_count}"/>
  ${input.notes ? `<Notas>${xmlEscape(input.notes)}</Notas>` : '<Notas/>'}
  <Sello algoritmo="SHA256" valor="PLACEHOLDER_SELLO"/>
</AVC>`
}

const styles = StyleSheet.create({
  page: { padding: 28, paddingBottom: 56, fontSize: 9, fontFamily: 'Helvetica', color: '#111827' },
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
  label: { fontSize: 7, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 },
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

function AvcDocument({ input }: { input: AvcInput }) {
  const now = new Date().toISOString()
  return (
    <PdfDoc>
      <Page size="A4" style={styles.page}>
        <AguilaPdfHeader
          title="AVC — AVISO DE CRUCE"
          subtitle={`Generada ${now}`}
          gradientId="silverGradAvc"
        />
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Generación local. Submisión a VUCEM/SAT pendiente para V2.
          </Text>
        </View>
        <Section
          title="Entrada de bodega"
          items={[
            ['ID entrada', input.warehouse_entry_id],
            ['Tráfico', input.trafico_id],
            ['Caja', input.trailer_number],
            ['Dock', input.dock_assigned ?? '—'],
            ['Receptor', input.received_by],
            ['Fecha recepción', input.received_at],
          ]}
        />
        <Section
          title="Partes"
          items={[
            ['RFC importador', input.rfc_importador],
            ['Patente', input.patente],
            ['Aduana', input.aduana],
            ['Fotos', String(input.photo_count)],
          ]}
        />
        {input.notes ? (
          <Section title="Notas" items={[['Observaciones', input.notes]]} />
        ) : null}
        <AguilaPdfFooter />
      </Page>
    </PdfDoc>
  )
}

export async function generateAVC(input: AvcInput): Promise<AvcOutput> {
  validate(input)
  const xml = buildXml(input)
  const pdf = await renderToBuffer(<AvcDocument input={input} />)
  return { pdf, xml }
}
