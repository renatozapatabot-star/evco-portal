import { describe, it, expect } from 'vitest'
import { parseCFDI, isCFDIFile } from '../parser'

const SAMPLE_CFDI = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  Version="4.0" Folio="A1234" Serie="F"
  Fecha="2026-04-13T10:15:00"
  Total="15420.50" SubTotal="13293.53" Moneda="MXN"
  TipoDeComprobante="I" FormaPago="03">
  <cfdi:Emisor Rfc="ACM950613ABC" Nombre="Acme Industrial de México S.A. de C.V." RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EVC920101XYZ" Nombre="EVCO Plastics de México" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto
      ClaveProdServ="40141800" NoIdentificacion="SKU-9001"
      Cantidad="10" ClaveUnidad="H87" Unidad="PZA"
      Descripcion="Molde de inyección ABS" ValorUnitario="1329.35" Importe="13293.53">
      <cfdi:InformacionAduanera NumeroPedimento="26 24 3596 6500441"/>
      <cfdi:CuentaPredial Numero="00000001"/>
    </cfdi:Concepto>
    <cfdi:Concepto
      ClaveProdServ="40141800" NoIdentificacion="SKU-9002"
      Cantidad="2" ClaveUnidad="H87" Unidad="PZA"
      Descripcion="Cable de control" ValorUnitario="500.00" Importe="1000.00"/>
  </cfdi:Conceptos>
</cfdi:Comprobante>`

describe('CFDI parser', () => {
  it('extracts folio, total, currency, emisor, receptor from a real-shape CFDI 4.0', () => {
    const out = parseCFDI(SAMPLE_CFDI)
    expect(out.invoice_number).toBe('A1234')
    expect(out.amount).toBe(15420.5)
    expect(out.currency).toBe('MXN')
    expect(out.supplier_name).toBe('Acme Industrial de México S.A. de C.V.')
    expect(out.rfcEmisor).toBe('ACM950613ABC')
    expect(out.rfcReceptor).toBe('EVC920101XYZ')
    expect(out.fecha).toBe('2026-04-13T10:15:00')
    expect(out.tipoComprobante).toBe('I')
    expect(out.confidence).toBe(0.98)
  })

  it('returns line items with fraccion when InformacionAduanera present', () => {
    const out = parseCFDI(SAMPLE_CFDI)
    expect(out.lineas).toHaveLength(2)
    expect(out.lineas[0].descripcion).toBe('Molde de inyección ABS')
    expect(out.lineas[0].importe).toBe(13293.53)
    expect(out.lineas[0].noIdentificacion).toBe('SKU-9001')
    expect(out.lineas[1].noIdentificacion).toBe('SKU-9002')
  })

  it('falls back to RFC when Emisor has no Nombre', () => {
    const xml = SAMPLE_CFDI.replace(/Nombre="Acme Industrial de México S.A. de C.V."/, '')
    const out = parseCFDI(xml)
    expect(out.supplier_name).toBe('ACM950613ABC')
  })

  it('currency outside MXN|USD normalizes to null', () => {
    const xml = SAMPLE_CFDI.replace(/Moneda="MXN"/, 'Moneda="EUR"')
    const out = parseCFDI(xml)
    expect(out.currency).toBeNull()
  })

  it('throws when Comprobante root is missing', () => {
    expect(() => parseCFDI('<?xml version="1.0"?><foo/>')).toThrow(/Comprobante/)
  })

  it('isCFDIFile detects by extension and mime type', () => {
    expect(isCFDIFile('invoice.xml', 'application/xml')).toBe(true)
    expect(isCFDIFile('INV.XML', 'application/octet-stream')).toBe(true)
    expect(isCFDIFile('file.pdf', 'application/pdf')).toBe(false)
    expect(isCFDIFile('file', 'text/xml')).toBe(true)
  })
})
