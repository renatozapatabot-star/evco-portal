/**
 * AGUILA · Block 15 — Client config validator tests.
 *
 * Twelve section tests + cross-section RFC consistency + completeness.
 */

import { describe, it, expect } from 'vitest'
import {
  computeCompleteness,
  validateClientConfig,
  type ValidationError,
} from '../client-config-validation'
import type { ClientConfigRow } from '../client-config-schema'

function emptyRow(overrides: Partial<ClientConfigRow> = {}): ClientConfigRow {
  return {
    company_id: 'test',
    general: {},
    direcciones: [],
    contactos: [],
    fiscal: {},
    aduanal_defaults: {},
    clasificacion_defaults: {},
    transportistas_preferidos: [],
    documentos_recurrentes: [],
    configuracion_facturacion: {},
    notificaciones: {},
    permisos_especiales: [],
    notas_internas: null,
    ...overrides,
  }
}

function errorsFor(errors: ValidationError[], section: string): ValidationError[] {
  return errors.filter(e => e.section === section)
}

describe('validateClientConfig — Section 1 general', () => {
  it('flags missing razon_social', () => {
    const e = validateClientConfig(emptyRow())
    expect(errorsFor(e, 'general').some(x => x.field === 'razon_social')).toBe(true)
  })
  it('accepts a filled razon_social', () => {
    const e = validateClientConfig(emptyRow({ general: { razon_social: 'EVCO Plastics de México' } }))
    expect(errorsFor(e, 'general').length).toBe(0)
  })
})

describe('validateClientConfig — Section 2 direcciones', () => {
  it('requires at least one address', () => {
    const e = validateClientConfig(emptyRow())
    expect(errorsFor(e, 'direcciones').some(x => x.field === '__count')).toBe(true)
  })
  it('rejects malformed cp', () => {
    const e = validateClientConfig(
      emptyRow({
        direcciones: [{ tipo: 'fiscal', calle: 'x', ciudad: 'x', estado: 'x', cp: '999', pais: 'MX' }],
      }),
    )
    expect(errorsFor(e, 'direcciones').some(x => x.field === 'cp')).toBe(true)
  })
})

describe('validateClientConfig — Section 3 contactos', () => {
  it('requires at least one contact', () => {
    const e = validateClientConfig(emptyRow())
    expect(errorsFor(e, 'contactos').some(x => x.field === '__count')).toBe(true)
  })
  it('rejects invalid email', () => {
    const e = validateClientConfig(
      emptyRow({ contactos: [{ nombre: 'Tito', rol: 'principal', email: 'not-an-email' }] }),
    )
    expect(errorsFor(e, 'contactos').some(x => x.field === 'email')).toBe(true)
  })
})

describe('validateClientConfig — Section 4 fiscal', () => {
  it('flags missing rfc and regimen_fiscal', () => {
    const e = validateClientConfig(emptyRow())
    const fiscalErrs = errorsFor(e, 'fiscal').map(x => x.field)
    expect(fiscalErrs).toContain('rfc')
    expect(fiscalErrs).toContain('regimen_fiscal')
  })
  it('rejects malformed RFC', () => {
    const e = validateClientConfig(emptyRow({ fiscal: { rfc: 'bogus', regimen_fiscal: '601' } }))
    expect(errorsFor(e, 'fiscal').some(x => x.field === 'rfc')).toBe(true)
  })
  it('accepts a valid moral RFC', () => {
    const e = validateClientConfig(emptyRow({ fiscal: { rfc: 'EPM010203ABC', regimen_fiscal: '601' } }))
    expect(errorsFor(e, 'fiscal').some(x => x.field === 'rfc')).toBe(false)
  })
})

describe('validateClientConfig — Section 5 aduanal_defaults', () => {
  it('flags missing patente/aduana/tipo_operacion', () => {
    const e = validateClientConfig(emptyRow())
    const fields = errorsFor(e, 'aduanal_defaults').map(x => x.field)
    expect(fields).toContain('patente')
    expect(fields).toContain('aduana')
    expect(fields).toContain('tipo_operacion')
  })
  it('rejects malformed patente and aduana', () => {
    const e = validateClientConfig(
      emptyRow({ aduanal_defaults: { patente: '12', aduana: '2400', tipo_operacion: 'importacion' } }),
    )
    const fields = errorsFor(e, 'aduanal_defaults').map(x => x.field)
    expect(fields).toContain('patente')
    expect(fields).toContain('aduana')
  })
})

describe('validateClientConfig — Section 6 clasificacion_defaults', () => {
  it('is always optional', () => {
    const e = validateClientConfig(emptyRow())
    expect(errorsFor(e, 'clasificacion_defaults').length).toBe(0)
  })
})

describe('validateClientConfig — Section 7 transportistas_preferidos', () => {
  it('flags rows missing carrier_id', () => {
    const e = validateClientConfig(
      emptyRow({
        transportistas_preferidos: [{ carrier_id: '', prioridad: 1 } as unknown as never],
      }),
    )
    expect(errorsFor(e, 'transportistas_preferidos').some(x => x.field === 'carrier_id')).toBe(true)
  })
})

describe('validateClientConfig — Section 8 documentos_recurrentes', () => {
  it('flags rows missing tipo', () => {
    const e = validateClientConfig(
      emptyRow({ documentos_recurrentes: [{ tipo: '' } as unknown as never] }),
    )
    expect(errorsFor(e, 'documentos_recurrentes').some(x => x.field === 'tipo')).toBe(true)
  })
})

describe('validateClientConfig — Section 9 configuracion_facturacion', () => {
  it('flags missing metodo_pago, plazo_dias, moneda', () => {
    const e = validateClientConfig(emptyRow())
    const fields = errorsFor(e, 'configuracion_facturacion').map(x => x.field)
    expect(fields).toContain('metodo_pago')
    expect(fields).toContain('plazo_dias')
    expect(fields).toContain('moneda')
  })
  it('rejects out-of-range plazo_dias', () => {
    const e = validateClientConfig(
      emptyRow({
        configuracion_facturacion: {
          metodo_pago: 'transferencia',
          plazo_dias: 999,
          moneda: 'MXN',
        },
      }),
    )
    expect(
      errorsFor(e, 'configuracion_facturacion').some(x => x.field === 'plazo_dias'),
    ).toBe(true)
  })
})

describe('validateClientConfig — Section 10 notificaciones', () => {
  it('flags missing canal_preferido', () => {
    const e = validateClientConfig(emptyRow())
    expect(errorsFor(e, 'notificaciones').some(x => x.field === 'canal_preferido')).toBe(true)
  })
  it('rejects invalid emails in email_alerts', () => {
    const e = validateClientConfig(
      emptyRow({
        notificaciones: { canal_preferido: 'email', email_alerts: ['good@x.com', 'nope'] },
      }),
    )
    expect(errorsFor(e, 'notificaciones').some(x => x.field.startsWith('email_alerts['))).toBe(true)
  })
})

describe('validateClientConfig — Section 11 permisos_especiales', () => {
  it('flags rows missing tipo or folio', () => {
    const e = validateClientConfig(
      emptyRow({ permisos_especiales: [{ tipo: '', folio: '' } as unknown as never] }),
    )
    const fields = errorsFor(e, 'permisos_especiales').map(x => x.field)
    expect(fields).toContain('tipo')
    expect(fields).toContain('folio')
  })
})

describe('validateClientConfig — Section 12 notas_internas', () => {
  it('is always valid (freeform)', () => {
    const e = validateClientConfig(emptyRow({ notas_internas: null }))
    expect(errorsFor(e, 'notas_internas').length).toBe(0)
    const e2 = validateClientConfig(emptyRow({ notas_internas: 'Cliente con historial difícil.' }))
    expect(errorsFor(e2, 'notas_internas').length).toBe(0)
  })
})

describe('validateClientConfig — cross-section RFC consistency', () => {
  it('requires a principal/facturacion contact when RFC is set', () => {
    const e = validateClientConfig(
      emptyRow({
        fiscal: { rfc: 'EPM010203ABC', regimen_fiscal: '601' },
        contactos: [{ nombre: 'Soporte', rol: 'otro' }],
      }),
    )
    expect(errorsFor(e, 'contactos').some(x => x.field === '__rfc_owner')).toBe(true)
  })
  it('passes when a principal contact exists', () => {
    const e = validateClientConfig(
      emptyRow({
        fiscal: { rfc: 'EPM010203ABC', regimen_fiscal: '601' },
        contactos: [{ nombre: 'Tito', rol: 'principal' }],
      }),
    )
    expect(errorsFor(e, 'contactos').some(x => x.field === '__rfc_owner')).toBe(false)
  })

  it('warns when billing email not in notificaciones email_alerts', () => {
    const e = validateClientConfig(
      emptyRow({
        configuracion_facturacion: {
          metodo_pago: 'transferencia',
          plazo_dias: 30,
          moneda: 'MXN',
          email_facturacion: 'fact@evco.mx',
        },
        notificaciones: { canal_preferido: 'email', email_alerts: ['ops@evco.mx'] },
      }),
    )
    const warn = e.find(x => x.section === 'notificaciones' && x.severity === 'warning')
    expect(warn).toBeTruthy()
  })
})

describe('computeCompleteness', () => {
  it('returns 100% for every section on a fully valid row', () => {
    const row = emptyRow({
      general: { razon_social: 'EVCO' },
      direcciones: [
        { tipo: 'fiscal', calle: 'x', ciudad: 'Laredo', estado: 'TX', cp: '78040', pais: 'MX' },
      ],
      contactos: [{ nombre: 'Tito', rol: 'principal' }],
      fiscal: { rfc: 'EPM010203ABC', regimen_fiscal: '601' },
      aduanal_defaults: { patente: '3596', aduana: '240', tipo_operacion: 'importacion' },
      configuracion_facturacion: { metodo_pago: 'transferencia', plazo_dias: 30, moneda: 'MXN' },
      notificaciones: { canal_preferido: 'email' },
    })
    const c = computeCompleteness(row)
    const byId = Object.fromEntries(c.map(x => [x.section, x.percent]))
    expect(byId['general']).toBe(100)
    expect(byId['fiscal']).toBe(100)
    expect(byId['aduanal_defaults']).toBe(100)
    expect(byId['configuracion_facturacion']).toBe(100)
    expect(byId['notificaciones']).toBe(100)
    expect(byId['direcciones']).toBe(100)
    expect(byId['contactos']).toBe(100)
    expect(byId['notas_internas']).toBe(100)
  })

  it('reports 0% on empty required sections', () => {
    const c = computeCompleteness(emptyRow())
    const general = c.find(x => x.section === 'general')!
    expect(general.percent).toBeLessThan(100)
    expect(general.missingRequired).toContain('razon_social')
  })
})
