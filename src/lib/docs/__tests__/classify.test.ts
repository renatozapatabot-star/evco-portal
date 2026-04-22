import { describe, it, expect } from 'vitest'
import {
  classifyByHeuristic,
  smartToLegacyVision,
  smartToLegacyClassifier,
  SMART_DOC_TYPES,
} from '../classify'

describe('classifyByHeuristic — CFDI / factura', () => {
  it('detects CFDI byte signature in sniff head at highest confidence', () => {
    const r = classifyByHeuristic({
      filename: 'random_name.xml',
      mimeType: 'text/xml',
      sniffHead:
        '<?xml version="1.0" encoding="UTF-8"?><cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4">',
    })
    expect(r.type).toBe('factura')
    expect(r.confidence).toBeGreaterThanOrEqual(0.95)
    expect(r.reason).toContain('CFDI')
  })

  it('XML + factura-ish filename classifies even without sniff', () => {
    const r = classifyByHeuristic({
      filename: 'FACTURA-CFDI_A1234.xml',
      mimeType: 'application/xml',
    })
    expect(r.type).toBe('factura')
    expect(r.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('PDF named factura_*.pdf classifies as factura with lower confidence', () => {
    const r = classifyByHeuristic({
      filename: 'factura_2026_0417.pdf',
      mimeType: 'application/pdf',
    })
    expect(r.type).toBe('factura')
    expect(r.confidence).toBeGreaterThan(0.7)
    expect(r.confidence).toBeLessThan(0.9)
  })
})

describe('classifyByHeuristic — customs doc types', () => {
  it('pedimento PDF', () => {
    const r = classifyByHeuristic({
      filename: 'pedimento_26_24_3596_6500441.pdf',
      mimeType: 'application/pdf',
    })
    expect(r.type).toBe('pedimento')
    expect(r.confidence).toBe(0.9)
  })

  it('carta porte variants', () => {
    for (const fn of [
      'carta porte 123.pdf',
      'cartaporte_2026.pdf',
      'carta-porte.pdf',
      'cp_88812.pdf',
    ]) {
      const r = classifyByHeuristic({ filename: fn, mimeType: 'application/pdf' })
      expect(r.type).toBe('carta_porte')
    }
  })

  it('bill of lading + conocimiento de embarque', () => {
    for (const fn of ['BoL-CMAU123.pdf', 'bill_of_lading.pdf', 'conocimiento_embarque.pdf']) {
      const r = classifyByHeuristic({ filename: fn, mimeType: 'application/pdf' })
      expect(r.type).toBe('bl')
    }
  })

  it('airway bill variants', () => {
    for (const fn of ['AWB-176-12345.pdf', 'airway_bill.pdf', 'guia aerea LATAM.pdf']) {
      const r = classifyByHeuristic({ filename: fn, mimeType: 'application/pdf' })
      expect(r.type).toBe('awb')
    }
  })

  it('packing list + lista de empaque', () => {
    for (const fn of ['packing_list.pdf', 'packinglist.pdf', 'lista empaque 2026.pdf']) {
      const r = classifyByHeuristic({ filename: fn, mimeType: 'application/pdf' })
      expect(r.type).toBe('packing_list')
    }
  })

  it('certificado de origen + T-MEC + USMCA', () => {
    for (const fn of [
      'certificado origen tmec.pdf',
      'cert origen MX.pdf',
      'T-MEC_2026.pdf',
      'usmca_CO_2025.pdf',
    ]) {
      const r = classifyByHeuristic({ filename: fn, mimeType: 'application/pdf' })
      expect(r.type).toBe('certificado_origen')
    }
  })

  it('RFC constancia', () => {
    for (const fn of ['constancia_situacion_fiscal.pdf', 'rfc_evco.pdf']) {
      const r = classifyByHeuristic({ filename: fn, mimeType: 'application/pdf' })
      expect(r.type).toBe('rfc')
    }
  })

  it('NOM certificate', () => {
    const r = classifyByHeuristic({
      filename: 'NOM-051-2025.pdf',
      mimeType: 'application/pdf',
    })
    expect(r.type).toBe('nom')
  })
})

describe('classifyByHeuristic — unknown fallback', () => {
  it('returns unknown when filename has no signals', () => {
    const r = classifyByHeuristic({
      filename: 'scan_001.pdf',
      mimeType: 'application/pdf',
    })
    expect(r.type).toBe('unknown')
    expect(r.confidence).toBe(0)
  })

  it('returns unknown for ambiguous image with no hints', () => {
    const r = classifyByHeuristic({
      filename: 'IMG_20260422.jpg',
      mimeType: 'image/jpeg',
    })
    expect(r.type).toBe('unknown')
  })
})

describe('legacy-union bridges', () => {
  it('smartToLegacyVision collapses BL + AWB to bol', () => {
    expect(smartToLegacyVision('bl')).toBe('bol')
    expect(smartToLegacyVision('awb')).toBe('bol')
    expect(smartToLegacyVision('factura')).toBe('invoice')
    expect(smartToLegacyVision('packing_list')).toBe('packing_list')
    expect(smartToLegacyVision('certificado_origen')).toBe('certificate_of_origin')
    expect(smartToLegacyVision('pedimento')).toBe('other')
    expect(smartToLegacyVision('rfc')).toBe('other')
    expect(smartToLegacyVision('nom')).toBe('other')
    expect(smartToLegacyVision('carta_porte')).toBe('other')
  })

  it('smartToLegacyClassifier is lossless on the 8 shared types', () => {
    expect(smartToLegacyClassifier('factura')).toBe('factura')
    expect(smartToLegacyClassifier('bl')).toBe('bill_of_lading')
    expect(smartToLegacyClassifier('awb')).toBe('bill_of_lading')
    expect(smartToLegacyClassifier('packing_list')).toBe('packing_list')
    expect(smartToLegacyClassifier('certificado_origen')).toBe('certificado_origen')
    expect(smartToLegacyClassifier('carta_porte')).toBe('carta_porte')
    expect(smartToLegacyClassifier('pedimento')).toBe('pedimento')
    expect(smartToLegacyClassifier('rfc')).toBe('rfc_constancia')
    expect(smartToLegacyClassifier('nom')).toBe('other')
    expect(smartToLegacyClassifier('other')).toBe('other')
  })

  it('every SMART_DOC_TYPE maps cleanly through both bridges', () => {
    for (const t of SMART_DOC_TYPES) {
      expect(smartToLegacyVision(t)).toMatch(
        /^(invoice|packing_list|bol|certificate_of_origin|other)$/,
      )
      expect(smartToLegacyClassifier(t)).toMatch(
        /^(factura|bill_of_lading|packing_list|certificado_origen|carta_porte|pedimento|rfc_constancia|other)$/,
      )
    }
  })
})
