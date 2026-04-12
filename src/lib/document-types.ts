/**
 * Block 4 · Supplier Doc Solicitation Polish — Document Type Catalog
 *
 * Single source of truth for supplier-solicitable document types. Recon-aligned
 * with V2_GLOBALPC_RECON.md (historical demand) and V2_ADUANET_RECON.md
 * (SAT/VUCEM/ANEXO 22 regulatory obligations).
 *
 * 50 entries across 9 categories. Legacy `DocType` union from doc-requirements.ts
 * is preserved via `legacyAlias` on matching entries, so `mapLegacyDocType()`
 * round-trips every old code into a catalog code without losing callers.
 *
 * Entries marked `reconSource: 'regulatory'` are additions for regulatory
 * completeness — they are not in either recon but are required by SAT or
 * sector regulators (NOM, COFEPRIS, SEMARNAT, SENER, SAGARPA).
 */
import type { DocType } from './doc-requirements'

export type DocCategory =
  | 'COMERCIAL'
  | 'TRANSPORTE'
  | 'ORIGEN'
  | 'REGULATORIO'
  | 'TECNICO'
  | 'FISCAL'
  | 'ADUANAL'
  | 'FINANCIERO'
  | 'OTROS'

export interface DocTypeEntry {
  code: string
  name_es: string
  desc?: string
  required?: boolean
  legacyAlias?: DocType
  reconSource: 'globalpc' | 'aduanet' | 'both' | 'regulatory'
  category: DocCategory
}

export const DOCUMENT_TYPE_CATEGORIES: Record<DocCategory, DocTypeEntry[]> = {
  COMERCIAL: [
    {
      code: 'factura_comercial',
      name_es: 'Factura comercial',
      desc: 'CFDI o factura internacional con valor y condiciones de venta',
      required: true,
      legacyAlias: 'factura',
      reconSource: 'both',
      category: 'COMERCIAL',
    },
    {
      code: 'lista_empaque',
      name_es: 'Lista de empaque',
      desc: 'Packing list con desglose por bulto y peso',
      required: true,
      legacyAlias: 'packing_list',
      reconSource: 'both',
      category: 'COMERCIAL',
    },
    {
      code: 'orden_compra',
      name_es: 'Orden de compra',
      desc: 'PO del comprador para vincular factura con pedido',
      reconSource: 'globalpc',
      category: 'COMERCIAL',
    },
    {
      code: 'proforma',
      name_es: 'Factura proforma',
      desc: 'Cotización previa al pedimento',
      reconSource: 'globalpc',
      category: 'COMERCIAL',
    },
    {
      code: 'contrato_compraventa',
      name_es: 'Contrato de compraventa',
      desc: 'Contrato marco cuando aplica',
      reconSource: 'aduanet',
      category: 'COMERCIAL',
    },
    {
      code: 'nota_venta',
      name_es: 'Nota de venta',
      desc: 'Documento simplificado de operación comercial',
      reconSource: 'globalpc',
      category: 'COMERCIAL',
    },
  ],
  TRANSPORTE: [
    {
      code: 'bl',
      name_es: 'Conocimiento de embarque (BL)',
      desc: 'Bill of Lading marítimo',
      required: true,
      legacyAlias: 'bill_of_lading',
      reconSource: 'both',
      category: 'TRANSPORTE',
    },
    {
      code: 'awb',
      name_es: 'Guía aérea (AWB)',
      desc: 'Air Waybill para embarques aéreos',
      reconSource: 'both',
      category: 'TRANSPORTE',
    },
    {
      code: 'carta_porte',
      name_es: 'Carta porte',
      desc: 'Complemento CFDI carta porte 3.1 para transporte terrestre',
      required: true,
      legacyAlias: 'carta_porte',
      reconSource: 'both',
      category: 'TRANSPORTE',
    },
    {
      code: 'guia_embarque',
      name_es: 'Guía de embarque',
      desc: 'Guía del transportista consolidador',
      reconSource: 'globalpc',
      category: 'TRANSPORTE',
    },
    {
      code: 'seguro_transporte',
      name_es: 'Póliza de seguro de transporte',
      desc: 'Cobertura del embarque',
      reconSource: 'aduanet',
      category: 'TRANSPORTE',
    },
    {
      code: 'manifiesto_carga',
      name_es: 'Manifiesto de carga',
      desc: 'Manifiesto del transportista',
      reconSource: 'aduanet',
      category: 'TRANSPORTE',
    },
  ],
  ORIGEN: [
    {
      code: 'certificado_origen_tmec',
      name_es: 'Certificado de origen T-MEC',
      desc: 'Para preferencia arancelaria USMCA/T-MEC',
      required: true,
      legacyAlias: 'certificado_origen',
      reconSource: 'both',
      category: 'ORIGEN',
    },
    {
      code: 'certificado_origen_otros',
      name_es: 'Certificado de origen (otros tratados)',
      desc: 'TLC con UE, Japón, CPTPP u otro',
      reconSource: 'aduanet',
      category: 'ORIGEN',
    },
    {
      code: 'declaracion_origen',
      name_es: 'Declaración de origen',
      desc: 'Declaración en factura cuando el tratado lo admite',
      reconSource: 'aduanet',
      category: 'ORIGEN',
    },
    {
      code: 'bom_materiales',
      name_es: 'Lista de materiales (BOM)',
      desc: 'Bill of materials para calcular contenido regional',
      reconSource: 'aduanet',
      category: 'ORIGEN',
    },
  ],
  REGULATORIO: [
    // added: regulatory completeness, not in recon.
    {
      code: 'nom',
      name_es: 'Certificado NOM',
      desc: 'Norma Oficial Mexicana aplicable a la mercancía',
      reconSource: 'regulatory',
      category: 'REGULATORIO',
    },
    // added: regulatory completeness, not in recon.
    {
      code: 'cofepris',
      name_es: 'Permiso COFEPRIS',
      desc: 'Sanitario para alimentos, farmacéuticos, cosméticos',
      reconSource: 'regulatory',
      category: 'REGULATORIO',
    },
    // added: regulatory completeness, not in recon.
    {
      code: 'sagarpa',
      name_es: 'Permiso SAGARPA/SENASICA',
      desc: 'Zoosanitario o fitosanitario',
      reconSource: 'regulatory',
      category: 'REGULATORIO',
    },
    // added: regulatory completeness, not in recon.
    {
      code: 'semarnat',
      name_es: 'Permiso SEMARNAT',
      desc: 'Medio ambiente — residuos, químicos peligrosos',
      reconSource: 'regulatory',
      category: 'REGULATORIO',
    },
    // added: regulatory completeness, not in recon.
    {
      code: 'sener',
      name_es: 'Permiso SENER',
      desc: 'Hidrocarburos y productos energéticos',
      reconSource: 'regulatory',
      category: 'REGULATORIO',
    },
    {
      code: 'permiso_importacion',
      name_es: 'Permiso de importación',
      desc: 'Permiso de la autoridad competente (SE u otra)',
      reconSource: 'globalpc',
      category: 'REGULATORIO',
    },
    {
      code: 'padron_importadores',
      name_es: 'Padrón de importadores',
      desc: 'Constancia de inscripción en el padrón',
      reconSource: 'aduanet',
      category: 'REGULATORIO',
    },
  ],
  TECNICO: [
    {
      code: 'coa',
      name_es: 'Certificado de análisis (COA)',
      desc: 'Para químicos, farmacéuticos, materias primas',
      reconSource: 'globalpc',
      category: 'TECNICO',
    },
    {
      code: 'ficha_tecnica',
      name_es: 'Ficha técnica',
      desc: 'Especificaciones técnicas del producto',
      reconSource: 'globalpc',
      category: 'TECNICO',
    },
    {
      code: 'msds',
      name_es: 'Hoja de seguridad (MSDS/SDS)',
      desc: 'Safety data sheet para químicos',
      reconSource: 'globalpc',
      category: 'TECNICO',
    },
    {
      code: 'fotos_mercancia',
      name_es: 'Fotografías de la mercancía',
      desc: 'Fotos de empaque, etiquetas, producto',
      reconSource: 'globalpc',
      category: 'TECNICO',
    },
    {
      code: 'catalogo',
      name_es: 'Catálogo o folleto',
      desc: 'Material de referencia para clasificación',
      reconSource: 'globalpc',
      category: 'TECNICO',
    },
    {
      code: 'dictamen_clasificacion',
      name_es: 'Dictamen de clasificación',
      desc: 'Opinión arancelaria previa (OCA u otra)',
      reconSource: 'aduanet',
      category: 'TECNICO',
    },
  ],
  FISCAL: [
    {
      code: 'rfc_constancia',
      name_es: 'Constancia de situación fiscal (RFC)',
      desc: 'Constancia del SAT vigente',
      required: true,
      legacyAlias: 'rfc_constancia',
      reconSource: 'both',
      category: 'FISCAL',
    },
    {
      code: 'cfdi_pago',
      name_es: 'CFDI de pago',
      desc: 'Complemento de pago cuando aplica',
      reconSource: 'aduanet',
      category: 'FISCAL',
    },
    {
      code: 'constancia_retenciones',
      name_es: 'Constancia de retenciones',
      desc: 'Retenciones ISR/IVA del proveedor',
      reconSource: 'aduanet',
      category: 'FISCAL',
    },
    {
      code: 'opinion_cumplimiento',
      name_es: 'Opinión de cumplimiento',
      desc: 'Opinión positiva SAT (32-D)',
      reconSource: 'aduanet',
      category: 'FISCAL',
    },
  ],
  ADUANAL: [
    {
      code: 'pedimento',
      name_es: 'Pedimento',
      desc: 'Pedimento aduanal (generado por el agente)',
      required: true,
      legacyAlias: 'pedimento',
      reconSource: 'both',
      category: 'ADUANAL',
    },
    {
      code: 'cove',
      name_es: 'COVE',
      desc: 'Comprobante de Valor Electrónico',
      required: true,
      legacyAlias: 'cove',
      reconSource: 'both',
      category: 'ADUANAL',
    },
    {
      code: 'mve',
      name_es: 'Manifestación de Valor (MVE)',
      desc: 'Anexo 1-B del pedimento',
      required: true,
      legacyAlias: 'mve',
      reconSource: 'both',
      category: 'ADUANAL',
    },
    {
      code: 'encargo_conferido',
      name_es: 'Encargo conferido',
      desc: 'Autorización al agente aduanal',
      required: true,
      legacyAlias: 'encargo_conferido',
      reconSource: 'both',
      category: 'ADUANAL',
    },
    {
      code: 'doda_previo',
      name_es: 'DODA / Previo',
      desc: 'Documento de Operación para Despacho Aduanero',
      reconSource: 'aduanet',
      category: 'ADUANAL',
    },
    {
      code: 'anexo_24',
      name_es: 'Anexo 24 IMMEX',
      desc: 'Reporte de operaciones IMMEX',
      reconSource: 'aduanet',
      category: 'ADUANAL',
    },
    {
      code: 'anexo_31',
      name_es: 'Anexo 31 SCCCyG',
      desc: 'Sistema de Control de Cuentas IMMEX',
      reconSource: 'aduanet',
      category: 'ADUANAL',
    },
    {
      code: 'declaratoria_mercancia',
      name_es: 'Declaratoria de mercancía',
      desc: 'Declaratoria conforme al art. 59 LA',
      reconSource: 'aduanet',
      category: 'ADUANAL',
    },
  ],
  FINANCIERO: [
    {
      code: 'comprobante_pago',
      name_es: 'Comprobante de pago internacional',
      desc: 'SWIFT o transferencia al proveedor',
      reconSource: 'aduanet',
      category: 'FINANCIERO',
    },
    {
      code: 'carta_credito',
      name_es: 'Carta de crédito',
      desc: 'Letter of Credit cuando aplica',
      reconSource: 'aduanet',
      category: 'FINANCIERO',
    },
    {
      code: 'estado_cuenta',
      name_es: 'Estado de cuenta bancario',
      desc: 'Evidencia del pago al proveedor',
      reconSource: 'aduanet',
      category: 'FINANCIERO',
    },
    {
      code: 'nota_credito',
      name_es: 'Nota de crédito',
      desc: 'Ajuste al valor facturado',
      reconSource: 'aduanet',
      category: 'FINANCIERO',
    },
    {
      code: 'factoraje',
      name_es: 'Contrato de factoraje',
      desc: 'Cesión de derechos de cobro',
      reconSource: 'aduanet',
      category: 'FINANCIERO',
    },
  ],
  OTROS: [
    {
      code: 'entrada_bodega',
      name_es: 'Entrada de bodega',
      desc: 'Confirmación de recepción en bodega',
      reconSource: 'globalpc',
      category: 'OTROS',
    },
    {
      code: 'correspondencia',
      name_es: 'Correspondencia del proveedor',
      desc: 'Correos o cartas aclaratorias',
      reconSource: 'globalpc',
      category: 'OTROS',
    },
    {
      code: 'evidencia_entrega',
      name_es: 'Evidencia de entrega (POD)',
      desc: 'Proof of delivery del transportista',
      reconSource: 'globalpc',
      category: 'OTROS',
    },
    {
      code: 'otro',
      name_es: 'Otro (especificar)',
      desc: 'Documento no listado — indicar nombre y descripción',
      reconSource: 'globalpc',
      category: 'OTROS',
    },
  ],
}

export const ALL_DOCUMENT_TYPES: DocTypeEntry[] = Object.values(
  DOCUMENT_TYPE_CATEGORIES,
).flat()

export function getDocumentTypeByCode(code: string): DocTypeEntry | undefined {
  return ALL_DOCUMENT_TYPES.find((entry) => entry.code === code)
}

export function getRequiredDocumentTypes(): DocTypeEntry[] {
  return ALL_DOCUMENT_TYPES.filter((entry) => entry.required === true)
}

export function getDocumentTypesByCategory(cat: DocCategory): DocTypeEntry[] {
  return DOCUMENT_TYPE_CATEGORIES[cat]
}

/**
 * Translate a legacy `DocType` union value into the new catalog code.
 * Preserves the 9 existing consumers. Unknown legacy codes pass through
 * (callers may already be feeding catalog codes).
 */
export function mapLegacyDocType(legacy: DocType | string): string {
  const hit = ALL_DOCUMENT_TYPES.find((entry) => entry.legacyAlias === legacy)
  if (hit) return hit.code
  return legacy
}

/**
 * Human label for a catalog code. When the code is `otro` and a custom
 * name was captured from the operator, the custom name wins.
 */
export function labelForDocCode(code: string, custom?: string): string {
  if (code === 'otro' && custom && custom.trim().length > 0) {
    return custom.trim()
  }
  const entry = getDocumentTypeByCode(code)
  if (entry) return entry.name_es
  // Fallback: pretty-print slug
  return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function categoryForDocCode(code: string): DocCategory {
  const entry = getDocumentTypeByCode(code)
  return entry?.category ?? 'OTROS'
}

/** Sanity constant — build-time reminder of catalog size. */
export const CATALOG_SIZE = 50
