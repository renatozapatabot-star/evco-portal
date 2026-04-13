/**
 * AGUILA · Block 16 — Carta Porte (CFDI 4.0 + Complemento Carta Porte 3.0).
 *
 * Pure generator: no I/O. Emits a placeholder CFDI envelope with the Carta
 * Porte complement wired in. The XSD is public; until we pin the exact
 * namespace/attribute set to the live SAT schema, the emitted XML carries
 * a PLACEHOLDER comment directing verification before submission.
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

export interface CartaPorteInput {
  trafico_id: string
  pedimento_number: string | null
  company_id: string
  rfc_emisor: string
  rfc_receptor: string
  fecha_emision: string // ISO 8601
  origen: {
    rfc: string
    domicilio: string
    pais: string
  }
  destino: {
    rfc: string
    domicilio: string
    pais: string
  }
  transporte: {
    tipo: 'autotransporte' | 'maritimo' | 'aereo' | 'ferroviario'
    placas: string | null
    configuracion_vehicular: string | null
  }
  mercancia: {
    descripcion: string
    peso_kg: number
    valor_mxn: number
    fraccion_arancelaria?: string | null
  }
}

export interface CartaPorteOutput {
  pdf: Buffer
  xml: string
}

export class CartaPorteValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message)
    this.name = 'CartaPorteValidationError'
  }
}

function validate(input: CartaPorteInput): void {
  if (!input.trafico_id) throw new CartaPorteValidationError('trafico_id', 'Embarque requerido')
  if (!input.rfc_emisor) throw new CartaPorteValidationError('rfc_emisor', 'RFC emisor requerido')
  if (!input.rfc_receptor) throw new CartaPorteValidationError('rfc_receptor', 'RFC receptor requerido')
  if (!input.fecha_emision) throw new CartaPorteValidationError('fecha_emision', 'Fecha de emisión requerida')
  if (!input.mercancia?.descripcion) throw new CartaPorteValidationError('mercancia.descripcion', 'Descripción de mercancía requerida')
  if (typeof input.mercancia.peso_kg !== 'number' || input.mercancia.peso_kg <= 0) {
    throw new CartaPorteValidationError('mercancia.peso_kg', 'Peso de mercancía inválido')
  }
  if (!input.origen?.domicilio) throw new CartaPorteValidationError('origen.domicilio', 'Domicilio de origen requerido')
  if (!input.destino?.domicilio) throw new CartaPorteValidationError('destino.domicilio', 'Domicilio de destino requerido')
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

function buildXml(input: CartaPorteInput): string {
  const ped = input.pedimento_number ?? ''
  const fraccion = input.mercancia.fraccion_arancelaria ?? ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- PLACEHOLDER: verify against official SAT CFDI 4.0 + Carta Porte 3.0 XSD before production use -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:cartaporte30="http://www.sat.gob.mx/CartaPorte30" Version="4.0" Fecha="${xmlEscape(input.fecha_emision)}" TipoDeComprobante="T">
  <cfdi:Emisor Rfc="${xmlEscape(input.rfc_emisor)}"/>
  <cfdi:Receptor Rfc="${xmlEscape(input.rfc_receptor)}"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="78101800" Cantidad="1" ClaveUnidad="KGM" Descripcion="${xmlEscape(input.mercancia.descripcion)}" ValorUnitario="${input.mercancia.valor_mxn}" Importe="${input.mercancia.valor_mxn}"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <cartaporte30:CartaPorte Version="3.0" TranspInternac="Sí" EntradaSalidaMerc="Entrada" PaisOrigenDestino="${xmlEscape(input.origen.pais)}" ViaEntradaSalida="${input.transporte.tipo}" TotalDistRec="0">
      <cartaporte30:Ubicaciones>
        <cartaporte30:Ubicacion TipoUbicacion="Origen" RFCRemitenteDestinatario="${xmlEscape(input.origen.rfc)}">
          <cartaporte30:Domicilio Calle="${xmlEscape(input.origen.domicilio)}" Pais="${xmlEscape(input.origen.pais)}"/>
        </cartaporte30:Ubicacion>
        <cartaporte30:Ubicacion TipoUbicacion="Destino" RFCRemitenteDestinatario="${xmlEscape(input.destino.rfc)}">
          <cartaporte30:Domicilio Calle="${xmlEscape(input.destino.domicilio)}" Pais="${xmlEscape(input.destino.pais)}"/>
        </cartaporte30:Ubicacion>
      </cartaporte30:Ubicaciones>
      <cartaporte30:Mercancias PesoBrutoTotal="${input.mercancia.peso_kg}" UnidadPeso="KGM" NumTotalMercancias="1">
        <cartaporte30:Mercancia BienesTransp="78101800" Descripcion="${xmlEscape(input.mercancia.descripcion)}" Cantidad="1" ClaveUnidad="KGM" PesoEnKg="${input.mercancia.peso_kg}" FraccionArancelaria="${xmlEscape(fraccion)}">
          <cartaporte30:DocumentacionAduanera TipoDocumento="01" NumPedimento="${xmlEscape(ped)}"/>
        </cartaporte30:Mercancia>
        <cartaporte30:Autotransporte PermSCT="TPAF01" NumPermisoSCT="PLACEHOLDER">
          <cartaporte30:IdentificacionVehicular ConfigVehicular="${xmlEscape(input.transporte.configuracion_vehicular ?? 'C2')}" PlacaVM="${xmlEscape(input.transporte.placas ?? '')}" AnioModeloVM="2024"/>
        </cartaporte30:Autotransporte>
      </cartaporte30:Mercancias>
    </cartaporte30:CartaPorte>
  </cfdi:Complemento>
</cfdi:Comprobante>`
}

const styles = StyleSheet.create({
  page: { padding: 28, paddingBottom: 56, fontSize: 9, fontFamily: 'Helvetica', color: '#111827' },
  section: {
    marginBottom: 10,
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

function CartaPorteDocument({ input }: { input: CartaPorteInput }) {
  return (
    <PdfDoc>
      <Page size="A4" style={styles.page}>
        <AguilaPdfHeader
          title="CARTA PORTE"
          subtitle={`Emitida ${input.fecha_emision}`}
          gradientId="silverGradCP"
        />
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Generación local. Submisión a VUCEM/SAT pendiente para V2.
          </Text>
        </View>
        <Section
          title="Partes"
          items={[
            ['RFC emisor', input.rfc_emisor],
            ['RFC receptor', input.rfc_receptor],
            ['Embarque', input.trafico_id],
            ['Pedimento', input.pedimento_number ?? '—'],
          ]}
        />
        <Section
          title="Origen"
          items={[
            ['RFC remitente', input.origen.rfc],
            ['Domicilio', input.origen.domicilio],
            ['País', input.origen.pais],
          ]}
        />
        <Section
          title="Destino"
          items={[
            ['RFC destinatario', input.destino.rfc],
            ['Domicilio', input.destino.domicilio],
            ['País', input.destino.pais],
          ]}
        />
        <Section
          title="Transporte"
          items={[
            ['Tipo', input.transporte.tipo],
            ['Placas', input.transporte.placas ?? '—'],
            ['Configuración', input.transporte.configuracion_vehicular ?? '—'],
          ]}
        />
        <Section
          title="Mercancía"
          items={[
            ['Descripción', input.mercancia.descripcion],
            ['Peso (kg)', input.mercancia.peso_kg.toLocaleString('es-MX')],
            ['Valor (MXN)', input.mercancia.valor_mxn.toLocaleString('es-MX')],
            ['Fracción', input.mercancia.fraccion_arancelaria ?? '—'],
          ]}
        />
        <AguilaPdfFooter />
      </Page>
    </PdfDoc>
  )
}

export async function generateCartaPorte(input: CartaPorteInput): Promise<CartaPorteOutput> {
  validate(input)
  const xml = buildXml(input)
  const pdf = await renderToBuffer(<CartaPorteDocument input={input} />)
  return { pdf, xml }
}
