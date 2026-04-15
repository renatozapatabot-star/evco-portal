/**
 * ZAPATA AI · Block 15 — Client Master Config validator.
 *
 * Pure function. Takes the full companies row (as read from Supabase with
 * all 12 JSONB columns) and returns every validation error found. Powers
 * the right-rail completeness meter AND the bottom-bar "Validar
 * configuración completa" button.
 *
 * Design notes:
 * - No side effects, no network, no throws — returns an array.
 * - Accepts partial / malformed input (defensive against old rows predating
 *   the migration).
 * - Cross-section rule: if `fiscal.rfc` is set and any `direcciones` row has
 *   a `tipo === 'fiscal'` shape, its `cp` must be Mexican (5 digits).
 */

import {
  ADUANA_REGEX,
  ARRAY_SECTION_MIN_ROWS,
  CLIENT_CONFIG_SECTIONS,
  CP_REGEX,
  EMAIL_REGEX,
  PATENTE_REGEX,
  REQUIRED_OBJECT_FIELDS,
  REQUIRED_ROW_FIELDS,
  RFC_REGEX,
  type ClientConfigRow,
  type ClientConfigSectionId,
} from './client-config-schema'

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationError {
  section: ClientConfigSectionId
  field: string
  message: string
  severity: ValidationSeverity
  /** For array sections: row index. Omitted for object/text sections. */
  rowIndex?: number
}

export interface SectionCompleteness {
  section: ClientConfigSectionId
  /** 0–100. */
  percent: number
  missingRequired: string[]
  rowCount?: number
}

function isNonEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v as object).length > 0
  return true
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

/* -------------------------------------------------------------------------- */
/* Per-section validators                                                     */
/* -------------------------------------------------------------------------- */

function validateGeneral(row: ClientConfigRow, errors: ValidationError[]): void {
  const obj = asRecord(row.general)
  const required = REQUIRED_OBJECT_FIELDS.general ?? []
  for (const field of required) {
    if (!isNonEmpty(obj[field])) {
      errors.push({
        section: 'general',
        field,
        message: `${field} es obligatorio`,
        severity: 'error',
      })
    }
  }
}

function validateFiscal(row: ClientConfigRow, errors: ValidationError[]): void {
  const obj = asRecord(row.fiscal)
  const required = REQUIRED_OBJECT_FIELDS.fiscal ?? []
  for (const field of required) {
    if (!isNonEmpty(obj[field])) {
      errors.push({
        section: 'fiscal',
        field,
        message: `${field} es obligatorio`,
        severity: 'error',
      })
    }
  }
  const rfc = obj.rfc
  if (typeof rfc === 'string' && rfc.trim().length > 0 && !RFC_REGEX.test(rfc.trim().toUpperCase())) {
    errors.push({
      section: 'fiscal',
      field: 'rfc',
      message: 'RFC inválido (formato esperado: XAXX010101000)',
      severity: 'error',
    })
  }
}

function validateAduanalDefaults(row: ClientConfigRow, errors: ValidationError[]): void {
  const obj = asRecord(row.aduanal_defaults)
  const required = REQUIRED_OBJECT_FIELDS.aduanal_defaults ?? []
  for (const field of required) {
    if (!isNonEmpty(obj[field])) {
      errors.push({
        section: 'aduanal_defaults',
        field,
        message: `${field} es obligatorio`,
        severity: 'error',
      })
    }
  }
  const patente = obj.patente
  if (typeof patente === 'string' && patente.length > 0 && !PATENTE_REGEX.test(patente)) {
    errors.push({
      section: 'aduanal_defaults',
      field: 'patente',
      message: 'Patente debe ser 4 dígitos',
      severity: 'error',
    })
  }
  const aduana = obj.aduana
  if (typeof aduana === 'string' && aduana.length > 0 && !ADUANA_REGEX.test(aduana)) {
    errors.push({
      section: 'aduanal_defaults',
      field: 'aduana',
      message: 'Aduana debe ser 3 dígitos (ej. 240)',
      severity: 'error',
    })
  }
}

function validateClasificacionDefaults(_row: ClientConfigRow, _errors: ValidationError[]): void {
  // All fields optional — classification defaults are advisory.
}

function validateFacturacion(row: ClientConfigRow, errors: ValidationError[]): void {
  const obj = asRecord(row.configuracion_facturacion)
  const required = REQUIRED_OBJECT_FIELDS.configuracion_facturacion ?? []
  for (const field of required) {
    if (!isNonEmpty(obj[field])) {
      errors.push({
        section: 'configuracion_facturacion',
        field,
        message: `${field} es obligatorio`,
        severity: 'error',
      })
    }
  }
  const plazo = obj.plazo_dias
  if (typeof plazo === 'number' && (plazo < 0 || plazo > 365)) {
    errors.push({
      section: 'configuracion_facturacion',
      field: 'plazo_dias',
      message: 'plazo_dias debe estar entre 0 y 365',
      severity: 'error',
    })
  }
  const email = obj.email_facturacion
  if (typeof email === 'string' && email.length > 0 && !EMAIL_REGEX.test(email)) {
    errors.push({
      section: 'configuracion_facturacion',
      field: 'email_facturacion',
      message: 'Email de facturación inválido',
      severity: 'error',
    })
  }
}

function validateNotificaciones(row: ClientConfigRow, errors: ValidationError[]): void {
  const obj = asRecord(row.notificaciones)
  const required = REQUIRED_OBJECT_FIELDS.notificaciones ?? []
  for (const field of required) {
    if (!isNonEmpty(obj[field])) {
      errors.push({
        section: 'notificaciones',
        field,
        message: `${field} es obligatorio`,
        severity: 'error',
      })
    }
  }
  const emails = obj.email_alerts
  if (Array.isArray(emails)) {
    emails.forEach((e, i) => {
      if (typeof e !== 'string' || !EMAIL_REGEX.test(e)) {
        errors.push({
          section: 'notificaciones',
          field: `email_alerts[${i}]`,
          message: 'Email inválido',
          severity: 'error',
        })
      }
    })
  }
}

function validateArraySection(
  section: ClientConfigSectionId,
  rows: unknown[],
  errors: ValidationError[],
): void {
  const min = ARRAY_SECTION_MIN_ROWS[section] ?? 0
  if (rows.length < min) {
    errors.push({
      section,
      field: '__count',
      message: `Se requieren al menos ${min} registro(s)`,
      severity: 'error',
    })
  }
  const requiredFields = REQUIRED_ROW_FIELDS[section] ?? []
  rows.forEach((raw, i) => {
    const row = asRecord(raw)
    for (const field of requiredFields) {
      if (!isNonEmpty(row[field])) {
        errors.push({
          section,
          field,
          rowIndex: i,
          message: `Fila ${i + 1}: ${field} es obligatorio`,
          severity: 'error',
        })
      }
    }
  })
}

function validateDirecciones(row: ClientConfigRow, errors: ValidationError[]): void {
  const rows = asArray(row.direcciones)
  validateArraySection('direcciones', rows, errors)
  rows.forEach((raw, i) => {
    const r = asRecord(raw)
    const cp = r.cp
    if (typeof cp === 'string' && cp.length > 0 && !CP_REGEX.test(cp)) {
      errors.push({
        section: 'direcciones',
        field: 'cp',
        rowIndex: i,
        message: `Fila ${i + 1}: código postal debe ser 5 dígitos`,
        severity: 'error',
      })
    }
  })
}

function validateContactos(row: ClientConfigRow, errors: ValidationError[]): void {
  const rows = asArray(row.contactos)
  validateArraySection('contactos', rows, errors)
  rows.forEach((raw, i) => {
    const r = asRecord(raw)
    const email = r.email
    if (typeof email === 'string' && email.length > 0 && !EMAIL_REGEX.test(email)) {
      errors.push({
        section: 'contactos',
        field: 'email',
        rowIndex: i,
        message: `Fila ${i + 1}: email inválido`,
        severity: 'error',
      })
    }
  })
}

function validateTransportistas(row: ClientConfigRow, errors: ValidationError[]): void {
  validateArraySection('transportistas_preferidos', asArray(row.transportistas_preferidos), errors)
}

function validateDocumentosRecurrentes(row: ClientConfigRow, errors: ValidationError[]): void {
  validateArraySection('documentos_recurrentes', asArray(row.documentos_recurrentes), errors)
}

function validatePermisos(row: ClientConfigRow, errors: ValidationError[]): void {
  validateArraySection('permisos_especiales', asArray(row.permisos_especiales), errors)
}

function validateNotasInternas(_row: ClientConfigRow, _errors: ValidationError[]): void {
  // Freeform text, always optional.
}

/* -------------------------------------------------------------------------- */
/* Cross-section rules                                                        */
/* -------------------------------------------------------------------------- */

function validateCrossSection(row: ClientConfigRow, errors: ValidationError[]): void {
  const fiscal = asRecord(row.fiscal)
  const rfc = typeof fiscal.rfc === 'string' ? fiscal.rfc.trim().toUpperCase() : ''
  const contactos = asArray(row.contactos)

  // Cross-rule 1: If fiscal RFC is present, at least one contact with rol
  // 'principal' OR 'facturacion' must exist, so SAT correspondence has an owner.
  if (rfc.length > 0 && RFC_REGEX.test(rfc)) {
    const hasOwner = contactos.some(raw => {
      const r = asRecord(raw)
      return r.rol === 'principal' || r.rol === 'facturacion'
    })
    if (!hasOwner) {
      errors.push({
        section: 'contactos',
        field: '__rfc_owner',
        message: 'Con RFC definido se requiere al menos un contacto con rol principal o facturación',
        severity: 'error',
      })
    }
  }

  // Cross-rule 2: If billing email is set, it should also appear in
  // notificaciones.email_alerts (soft warning, not blocking).
  const billing = asRecord(row.configuracion_facturacion)
  const billingEmail = typeof billing.email_facturacion === 'string' ? billing.email_facturacion : ''
  const notif = asRecord(row.notificaciones)
  const alerts = Array.isArray(notif.email_alerts) ? (notif.email_alerts as unknown[]) : []
  if (billingEmail.length > 0 && !alerts.includes(billingEmail)) {
    errors.push({
      section: 'notificaciones',
      field: 'email_alerts',
      message: 'Email de facturación no está en alertas — considere agregarlo',
      severity: 'warning',
    })
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export function validateClientConfig(row: ClientConfigRow): ValidationError[] {
  const errors: ValidationError[] = []
  validateGeneral(row, errors)
  validateDirecciones(row, errors)
  validateContactos(row, errors)
  validateFiscal(row, errors)
  validateAduanalDefaults(row, errors)
  validateClasificacionDefaults(row, errors)
  validateTransportistas(row, errors)
  validateDocumentosRecurrentes(row, errors)
  validateFacturacion(row, errors)
  validateNotificaciones(row, errors)
  validatePermisos(row, errors)
  validateNotasInternas(row, errors)
  validateCrossSection(row, errors)
  return errors
}

/**
 * Completeness per section. Used by the right rail.
 */
export function computeCompleteness(row: ClientConfigRow): SectionCompleteness[] {
  const errors = validateClientConfig(row).filter(e => e.severity === 'error')
  return CLIENT_CONFIG_SECTIONS.map(meta => {
    const sectionErrors = errors.filter(e => e.section === meta.id)
    if (meta.kind === 'text') {
      // Always 100% complete — freeform.
      return { section: meta.id, percent: 100, missingRequired: [] }
    }
    if (meta.kind === 'array') {
      const rows = asArray((row as unknown as Record<string, unknown>)[meta.id])
      const min = ARRAY_SECTION_MIN_ROWS[meta.id] ?? 0
      if (sectionErrors.length === 0) {
        return { section: meta.id, percent: 100, missingRequired: [], rowCount: rows.length }
      }
      // Partial credit: errors scale down %.
      const denom = Math.max(1, sectionErrors.length + (rows.length || 1))
      const percent = Math.max(0, Math.round(100 * (1 - sectionErrors.length / denom)))
      return {
        section: meta.id,
        percent,
        missingRequired: sectionErrors.map(e => e.field),
        rowCount: rows.length,
      }
    }
    // Object section.
    const required = REQUIRED_OBJECT_FIELDS[meta.id] ?? []
    if (required.length === 0) {
      return { section: meta.id, percent: sectionErrors.length === 0 ? 100 : 50, missingRequired: sectionErrors.map(e => e.field) }
    }
    const missing = sectionErrors.map(e => e.field)
    const percent = Math.round(100 * (1 - Math.min(missing.length, required.length) / required.length))
    return { section: meta.id, percent, missingRequired: missing }
  })
}
