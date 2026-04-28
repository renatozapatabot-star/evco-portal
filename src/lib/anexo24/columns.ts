// Anexo 24 · 13-column GlobalPC-parity contract (2026-04-28).
//
// One source of truth for the screen at `/anexo-24`, the PDF + XLSX
// exports at `/api/reports/anexo-24/generate`, and the CSV at
// `/api/anexo-24/csv`. Drift between surfaces is what shipped a
// "(placeholder) — pendiente verificación" XLSX to a client; this
// module ends that drift.
//
// Column choice + ordering match the reference Excel pulled from
// GlobalPC for EVCO 2026-Q1. T-MEC eligibility derives from the
// pedimento regimen (`ITE` / `ITR` / `IMD`) per the existing
// `isTmec()` helper used by the Formato 53 exporter — same
// classification, same answer.

export type Anexo24ColumnKey =
  | 'consecutivo'
  | 'pedimento'
  | 'fecha'
  | 'embarque'
  | 'fraccion'
  | 'descripcion'
  | 'cantidad'
  | 'umc'
  | 'valor_usd'
  | 'proveedor'
  | 'pais'
  | 'regimen'
  | 'tmec'

export interface Anexo24Column {
  key: Anexo24ColumnKey
  header: string
  /** Right-align in PDF + XLSX. */
  align?: 'left' | 'right'
  /** Render with the JetBrains Mono `.portal-num` class on screen. */
  mono: boolean
  /** Excel column width in `xlsx`-units (≈ characters). */
  xlsxWidth: number
  /** Optional PDF column width as a percentage of page width. */
  pdfWidth: string
}

export const ANEXO24_COLUMNS: readonly Anexo24Column[] = [
  { key: 'consecutivo', header: 'No.',          align: 'right', mono: true,  xlsxWidth: 6,  pdfWidth: '4%'  },
  { key: 'pedimento',   header: 'Pedimento',                    mono: true,  xlsxWidth: 22, pdfWidth: '11%' },
  { key: 'fecha',       header: 'Fecha',                        mono: true,  xlsxWidth: 12, pdfWidth: '7%'  },
  { key: 'embarque',    header: 'Embarque',                     mono: true,  xlsxWidth: 14, pdfWidth: '8%'  },
  { key: 'fraccion',    header: 'Fracción',                     mono: true,  xlsxWidth: 12, pdfWidth: '8%'  },
  { key: 'descripcion', header: 'Descripción',                  mono: false, xlsxWidth: 36, pdfWidth: '20%' },
  { key: 'cantidad',    header: 'Cantidad',     align: 'right', mono: true,  xlsxWidth: 12, pdfWidth: '7%'  },
  { key: 'umc',         header: 'UMC',                          mono: true,  xlsxWidth: 8,  pdfWidth: '4%'  },
  { key: 'valor_usd',   header: 'Valor USD',    align: 'right', mono: true,  xlsxWidth: 14, pdfWidth: '8%'  },
  { key: 'proveedor',   header: 'Proveedor',                    mono: false, xlsxWidth: 28, pdfWidth: '12%' },
  { key: 'pais',        header: 'País',                         mono: true,  xlsxWidth: 6,  pdfWidth: '3%'  },
  { key: 'regimen',     header: 'Régimen',                      mono: true,  xlsxWidth: 8,  pdfWidth: '4%'  },
  { key: 'tmec',        header: 'T-MEC',                        mono: true,  xlsxWidth: 6,  pdfWidth: '4%'  },
] as const

/** Regimen codes that carry T-MEC preference for the row. Mirrors
 *  `isTmec()` in the legacy 41-col exporter so existing data renders
 *  identically while we converge on the 13-col contract. */
export function isTmecRegimen(regimen: string | null | undefined): boolean {
  const r = (regimen ?? '').toUpperCase()
  return r === 'ITE' || r === 'ITR' || r === 'IMD'
}
