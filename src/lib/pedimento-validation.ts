/**
 * AGUILA · Block 6a — Pedimento validation engine.
 *
 * Pure function. No I/O, no zod. Returns `ValidationError[]` grouped by tab.
 * Tests land in Slice B6c. Rules are recon-informed (docs/recon/V2_GLOBALPC_RECON.md)
 * and will expand after operator feedback.
 */

import type {
  FullPedimento,
  PedimentoRow,
  ValidationError,
  RegimeType,
  DocumentType,
  TabId,
} from './pedimento-types'

const PATENTE_RE = /^\d{4}$/
const ADUANA_RE = /^\d{3}$/
const RFC_RE = /^([A-ZÑ&]{3,4})\d{6}([A-Z\d]{3})$/
const FRACCION_RE = /^\d{4}\.\d{2}\.\d{2}$/

// Regimes that move goods (require partidas + transport)
const GOODS_REGIMES: readonly RegimeType[] = [
  'A1','IN','EX','H1','F4','T1','V1','ITE','ITR','IMD','RT',
] as const

function isGoodsRegime(r: RegimeType | null): boolean {
  return r !== null && (GOODS_REGIMES as readonly string[]).includes(r)
}

function err(tab: TabId, field: string, message: string, severity: 'error'|'warning' = 'error'): ValidationError {
  return { tab, field, severity, message }
}

/**
 * Regime → allowed document_type table. Import regimes (A1/H1/IN/ITE/ITR/IMD/RT)
 * accept IM/C1/T1; export regimes (EX/V1/F4) accept EX/T1.
 */
function documentTypeAllowedFor(regime: RegimeType): DocumentType[] {
  const imports: RegimeType[] = ['A1','H1','IN','ITE','ITR','IMD','RT']
  const exports: RegimeType[] = ['EX','V1','F4']
  if (imports.includes(regime)) return ['IM','C1','T1','F4']
  if (exports.includes(regime)) return ['EX','T1','F4']
  return ['IM','EX','C1','T1','F4']
}

function validateDatosGenerales(parent: PedimentoRow, ref?: number | null): ValidationError[] {
  const out: ValidationError[] = []
  if (!PATENTE_RE.test(parent.patente ?? '')) {
    out.push(err('datos_generales','patente','Patente debe ser 4 dígitos'))
  }
  if (!ADUANA_RE.test(parent.aduana ?? '')) {
    out.push(err('datos_generales','aduana','Aduana debe ser 3 dígitos'))
  }
  if (!parent.regime_type) {
    out.push(err('datos_generales','regime_type','Régimen requerido'))
  } else if (parent.document_type) {
    const allowed = documentTypeAllowedFor(parent.regime_type)
    if (!allowed.includes(parent.document_type)) {
      out.push(err('datos_generales','document_type',
        `Tipo de documento ${parent.document_type} incompatible con régimen ${parent.regime_type}`))
    }
  }
  if (parent.exchange_rate !== null && parent.exchange_rate !== undefined) {
    if (parent.exchange_rate <= 0) {
      out.push(err('datos_generales','exchange_rate','Tipo de cambio debe ser > 0'))
    } else if (ref && ref > 0) {
      const ratio = parent.exchange_rate / ref
      if (ratio < 0.5 || ratio > 1.5) {
        out.push(err('datos_generales','exchange_rate',
          `Tipo de cambio fuera de rango vs referencia (${ref.toFixed(4)})`, 'warning'))
      }
    }
  }
  return out
}

function validateCliente(parent: PedimentoRow): ValidationError[] {
  const out: ValidationError[] = []
  if (parent.cliente_rfc && !RFC_RE.test(parent.cliente_rfc)) {
    out.push(err('cliente_observaciones','cliente_rfc','RFC con formato inválido'))
  }
  const identifiers = parent.identifiers ?? {}
  for (const key of Object.keys(identifiers)) {
    if (key.trim().length === 0) {
      out.push(err('cliente_observaciones','identifiers','Los identificadores deben tener nombre'))
      break
    }
  }
  return out
}

function validateFacturas(ped: FullPedimento): ValidationError[] {
  const out: ValidationError[] = []
  if (ped.parent.document_type === 'IM' && ped.facturas.length === 0) {
    out.push(err('facturas_proveedores','facturas','Se requiere al menos una factura para importación'))
  }
  return out
}

function validatePartidas(ped: FullPedimento): ValidationError[] {
  const out: ValidationError[] = []
  if (!isGoodsRegime(ped.parent.regime_type)) return out

  if (ped.partidas.length === 0) {
    out.push(err('partidas','partidas','Se requiere al menos una partida para el régimen declarado'))
    return out
  }
  ped.partidas.forEach((p, idx) => {
    if (!p.fraccion || !FRACCION_RE.test(p.fraccion)) {
      out.push(err('partidas', `partidas[${idx}].fraccion`, 'Fracción debe tener formato XXXX.XX.XX'))
    }
    if (!p.cantidad || p.cantidad <= 0) {
      out.push(err('partidas', `partidas[${idx}].cantidad`, 'Cantidad debe ser mayor que 0'))
    }
    if (!p.pais_origen) {
      out.push(err('partidas', `partidas[${idx}].pais_origen`, 'País de origen requerido'))
    }
  })
  return out
}

function validateTransportistas(ped: FullPedimento): ValidationError[] {
  const out: ValidationError[] = []
  if (isGoodsRegime(ped.parent.regime_type) && ped.transportistas.length === 0) {
    out.push(err('transportistas','transportistas','Se requiere al menos un transportista'))
  }
  return out
}

function validateContribuciones(ped: FullPedimento): ValidationError[] {
  const out: ValidationError[] = []
  const owedTypes = new Set(['DTA','IGI'])
  const owesPayment = ped.contribuciones.some(c =>
    c.contribution_type &&
    owedTypes.has(c.contribution_type.toUpperCase()) &&
    (c.amount ?? 0) > 0,
  )
  if (owesPayment && ped.pagos_virtuales.length === 0) {
    out.push(err('contribuciones','pago_virtual',
      'Existen DTA/IGI > 0 sin forma de pago virtual correspondiente'))
  }
  return out
}

function validateCrossTabTotals(ped: FullPedimento): ValidationError[] {
  const out: ValidationError[] = []
  const declared = ped.declared_total_mxn
  if (declared === null || declared === undefined) return out
  const sum = ped.partidas.reduce((acc, p) => acc + (p.valor_comercial ?? 0), 0)
  if (Math.abs(sum - declared) > 1) {
    out.push(err('partidas','total',
      `Suma de partidas (${sum.toFixed(2)}) no coincide con total declarado (${declared.toFixed(2)})`))
  }
  return out
}

export function validatePedimento(ped: FullPedimento): ValidationError[] {
  return [
    ...validateDatosGenerales(ped.parent, ped.exchange_rate_reference ?? null),
    ...validateCliente(ped.parent),
    ...validateFacturas(ped),
    ...validatePartidas(ped),
    ...validateTransportistas(ped),
    ...validateContribuciones(ped),
    ...validateCrossTabTotals(ped),
  ]
}
