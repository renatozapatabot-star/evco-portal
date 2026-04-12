/**
 * AGUILA · Block 15 — Client Master 12-Section Config schema.
 *
 * Type shapes for each of the 12 JSONB columns on `companies` added by
 * migration 20260425_companies_master_config.sql, plus required-field maps
 * used by the completeness meter and validator.
 *
 * These are pure TypeScript types — no runtime cost. The validator
 * (`client-config-validation.ts`) inspects real rows at runtime.
 */

export type ClientConfigSectionId =
  | 'general'
  | 'direcciones'
  | 'contactos'
  | 'fiscal'
  | 'aduanal_defaults'
  | 'clasificacion_defaults'
  | 'transportistas_preferidos'
  | 'documentos_recurrentes'
  | 'configuracion_facturacion'
  | 'notificaciones'
  | 'permisos_especiales'
  | 'notas_internas'

export interface ClientConfigSectionMeta {
  id: ClientConfigSectionId
  label: string
  /** Serialized JSONB shape: `object` or `array`, or `text` for notas_internas. */
  kind: 'object' | 'array' | 'text'
}

export const CLIENT_CONFIG_SECTIONS: readonly ClientConfigSectionMeta[] = [
  { id: 'general',                   label: 'General',                 kind: 'object' },
  { id: 'direcciones',               label: 'Direcciones',             kind: 'array'  },
  { id: 'contactos',                 label: 'Contactos',               kind: 'array'  },
  { id: 'fiscal',                    label: 'Fiscal',                  kind: 'object' },
  { id: 'aduanal_defaults',          label: 'Defaults Aduanales',      kind: 'object' },
  { id: 'clasificacion_defaults',    label: 'Defaults Clasificación',  kind: 'object' },
  { id: 'transportistas_preferidos', label: 'Transportistas Preferidos', kind: 'array' },
  { id: 'documentos_recurrentes',    label: 'Documentos Recurrentes',  kind: 'array'  },
  { id: 'configuracion_facturacion', label: 'Configuración Facturación', kind: 'object' },
  { id: 'notificaciones',            label: 'Notificaciones',          kind: 'object' },
  { id: 'permisos_especiales',       label: 'Permisos Especiales',     kind: 'array'  },
  { id: 'notas_internas',            label: 'Notas Internas',          kind: 'text'   },
] as const

/* -------------------------------------------------------------------------- */
/* Section 1 — General                                                        */
/* -------------------------------------------------------------------------- */
export interface GeneralConfig {
  razon_social?: string
  nombre_comercial?: string
  website?: string
  logo_url?: string
}

/* -------------------------------------------------------------------------- */
/* Section 2 — Direcciones (array)                                            */
/* -------------------------------------------------------------------------- */
export type DireccionTipo = 'fiscal' | 'embarque' | 'entrega' | 'sucursal'
export interface DireccionRow {
  tipo: DireccionTipo
  calle?: string
  numero_exterior?: string
  numero_interior?: string
  colonia?: string
  ciudad?: string
  estado?: string
  cp?: string
  pais?: string
}

/* -------------------------------------------------------------------------- */
/* Section 3 — Contactos (array)                                              */
/* -------------------------------------------------------------------------- */
export type ContactoRol = 'principal' | 'facturacion' | 'operaciones' | 'aduanal' | 'otro'
export interface ContactoRow {
  nombre: string
  puesto?: string
  email?: string
  telefono?: string
  rol: ContactoRol
}

/* -------------------------------------------------------------------------- */
/* Section 4 — Fiscal                                                         */
/* -------------------------------------------------------------------------- */
export interface FiscalConfig {
  rfc?: string
  regimen_fiscal?: string
  uso_cfdi?: string
  csf_url?: string
}

/* -------------------------------------------------------------------------- */
/* Section 5 — Aduanal Defaults                                               */
/* -------------------------------------------------------------------------- */
export interface AduanalDefaults {
  patente?: string
  aduana?: string
  tipo_operacion?: 'importacion' | 'exportacion' | 'ambos'
  incoterm_default?: string
  moneda_default?: 'MXN' | 'USD' | 'EUR'
}

/* -------------------------------------------------------------------------- */
/* Section 6 — Clasificación Defaults                                         */
/* -------------------------------------------------------------------------- */
export interface ClasificacionDefaults {
  fracciones_favoritas?: string[]
  noms_aplicables?: string[]
  permisos_requeridos?: string[]
  notas_clasificacion?: string
}

/* -------------------------------------------------------------------------- */
/* Section 7 — Transportistas Preferidos (array)                              */
/* -------------------------------------------------------------------------- */
export interface TransportistaPreferidoRow {
  carrier_id: string
  carrier_name?: string
  prioridad: number
}

/* -------------------------------------------------------------------------- */
/* Section 8 — Documentos Recurrentes (array)                                 */
/* -------------------------------------------------------------------------- */
export interface DocumentoRecurrenteRow {
  tipo: string
  descripcion?: string
  vigencia_meses?: number
  fecha_renovacion?: string
}

/* -------------------------------------------------------------------------- */
/* Section 9 — Configuración Facturación                                      */
/* -------------------------------------------------------------------------- */
export interface FacturacionConfig {
  metodo_pago?: 'transferencia' | 'cheque' | 'efectivo' | 'credito'
  plazo_dias?: number
  moneda?: 'MXN' | 'USD'
  email_facturacion?: string
}

/* -------------------------------------------------------------------------- */
/* Section 10 — Notificaciones                                                */
/* -------------------------------------------------------------------------- */
export interface NotificacionesConfig {
  email_alerts?: string[]
  telegram_chat_id?: string
  whatsapp_numero?: string
  canal_preferido?: 'email' | 'telegram' | 'whatsapp'
}

/* -------------------------------------------------------------------------- */
/* Section 11 — Permisos Especiales (array)                                   */
/* -------------------------------------------------------------------------- */
export interface PermisoEspecialRow {
  tipo: string
  folio: string
  fecha_vigencia?: string
  descripcion?: string
}

/* -------------------------------------------------------------------------- */
/* Full row shape as it lives on the `companies` table.                       */
/* -------------------------------------------------------------------------- */
export interface ClientConfigRow {
  company_id: string
  general: GeneralConfig
  direcciones: DireccionRow[]
  contactos: ContactoRow[]
  fiscal: FiscalConfig
  aduanal_defaults: AduanalDefaults
  clasificacion_defaults: ClasificacionDefaults
  transportistas_preferidos: TransportistaPreferidoRow[]
  documentos_recurrentes: DocumentoRecurrenteRow[]
  configuracion_facturacion: FacturacionConfig
  notificaciones: NotificacionesConfig
  permisos_especiales: PermisoEspecialRow[]
  notas_internas: string | null
}

/* -------------------------------------------------------------------------- */
/* Required-field maps                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Required top-level fields on object-shaped sections. For array sections the
 * completeness meter uses `ARRAY_SECTION_MIN_ROWS` instead.
 */
export const REQUIRED_OBJECT_FIELDS: Partial<
  Record<ClientConfigSectionId, readonly string[]>
> = {
  general: ['razon_social'],
  fiscal: ['rfc', 'regimen_fiscal'],
  aduanal_defaults: ['patente', 'aduana', 'tipo_operacion'],
  clasificacion_defaults: [],
  configuracion_facturacion: ['metodo_pago', 'plazo_dias', 'moneda'],
  notificaciones: ['canal_preferido'],
}

/**
 * Minimum row counts for array-shaped sections to be considered complete.
 * Zero = optional. The completeness meter still surfaces the count.
 */
export const ARRAY_SECTION_MIN_ROWS: Partial<
  Record<ClientConfigSectionId, number>
> = {
  direcciones: 1,            // at least fiscal address
  contactos: 1,              // at least one contact
  transportistas_preferidos: 0,
  documentos_recurrentes: 0,
  permisos_especiales: 0,
}

/**
 * Required fields WITHIN each array row (per-row validation).
 */
export const REQUIRED_ROW_FIELDS: Partial<
  Record<ClientConfigSectionId, readonly string[]>
> = {
  direcciones: ['tipo', 'calle', 'ciudad', 'estado', 'cp', 'pais'],
  contactos: ['nombre', 'rol'],
  transportistas_preferidos: ['carrier_id', 'prioridad'],
  documentos_recurrentes: ['tipo'],
  permisos_especiales: ['tipo', 'folio'],
}

/** RFC format: 12-13 alphanumeric chars (Mexican moral or physical). */
export const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/

/** Mexican CP: 5 digits. */
export const CP_REGEX = /^\d{5}$/

/** Email: pragmatic, not RFC 5322. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Patente: 4 digits. */
export const PATENTE_REGEX = /^\d{4}$/

/** Aduana: 3 digits (e.g. 240 = Nuevo Laredo). */
export const ADUANA_REGEX = /^\d{3}$/
