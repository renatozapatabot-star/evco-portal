/**
 * AGUILA · V1.5 F2 — QuickBooks IIF generator.
 *
 * Pure functions, no I/O. Produces a minimal but correct Intuit Interchange
 * Format (.IIF) file: tab-separated, CRLF line endings, UTF-8. Anabel drags
 * the file into QuickBooks Desktop; every invoice lands with customer
 * references and line items.
 *
 * IIF spec (Intuit reference, condensed):
 *   !HDR  <columns>                    — header row, defines field order
 *   CUST / VEND / TRNS / SPL / ENDTRNS — data rows
 *   Tabs as delimiters, one logical row per line, CRLF line breaks.
 */

export interface QBCustomer {
  name: string
  taxId?: string | null
  companyName?: string | null
}

export interface QBVendor {
  name: string
  taxId?: string | null
}

export interface QBLineItem {
  account: string
  amount: number
  memo?: string | null
  quantity?: number | null
  fraccion?: string | null
}

export interface QBInvoice {
  invoiceNumber: string
  date: string // YYYY-MM-DD
  customerName: string
  currency: 'MXN' | 'USD'
  memo?: string | null
  lines: QBLineItem[]
}

export interface QBBill {
  billNumber: string
  date: string // YYYY-MM-DD
  vendorName: string
  currency: 'MXN' | 'USD'
  memo?: string | null
  lines: QBLineItem[]
}

export interface IIFPayload {
  customers?: QBCustomer[]
  vendors?: QBVendor[]
  invoices?: QBInvoice[]
  bills?: QBBill[]
}

const CRLF = '\r\n'

/**
 * Escape a field value for IIF. IIF is tab-separated; any embedded tab,
 * newline, or CR must be stripped (QuickBooks rejects the row otherwise).
 * We replace with a single space to preserve readability in memo fields.
 */
export function escapeIIFField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const raw = typeof value === 'string' ? value : String(value)
  return raw.replace(/[\t\r\n]/g, ' ')
}

function row(...cells: unknown[]): string {
  return cells.map(escapeIIFField).join('\t')
}

function formatDate(isoDate: string): string {
  // IIF expects MM/DD/YYYY. Parse a YYYY-MM-DD string defensively.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!match) return isoDate
  const [, y, m, d] = match
  return `${m}/${d}/${y}`
}

function formatAmount(amount: number): string {
  // QuickBooks accepts up to 2 decimals. Negative = credit.
  return (Math.round(amount * 100) / 100).toFixed(2)
}

/**
 * Build a single TRNS/SPL/ENDTRNS block for one invoice.
 *
 * TRNS header = total (negative = debit to A/R in IIF convention for INVOICE)
 * SPL lines  = per-partida income account rows (opposite sign of TRNS)
 */
function invoiceBlock(inv: QBInvoice): string[] {
  const lines: string[] = []
  const total = inv.lines.reduce((sum, l) => sum + l.amount, 0)

  // TRNS: receivable entry (positive amount — money OWED to us)
  lines.push(row(
    'TRNS', '', 'INVOICE', formatDate(inv.date), 'Accounts Receivable',
    inv.customerName, inv.currency, formatAmount(total),
    inv.invoiceNumber, inv.memo ?? '',
  ))

  for (const line of inv.lines) {
    const memo = [line.memo, line.fraccion].filter(Boolean).join(' · ')
    lines.push(row(
      'SPL', '', 'INVOICE', formatDate(inv.date), line.account,
      inv.customerName, inv.currency, formatAmount(-line.amount),
      inv.invoiceNumber, memo, line.quantity ?? '',
    ))
  }

  lines.push('ENDTRNS')
  return lines
}

function billBlock(bill: QBBill): string[] {
  const lines: string[] = []
  const total = bill.lines.reduce((sum, l) => sum + l.amount, 0)

  // TRNS: payable entry (negative = liability)
  lines.push(row(
    'TRNS', '', 'BILL', formatDate(bill.date), 'Accounts Payable',
    bill.vendorName, bill.currency, formatAmount(-total),
    bill.billNumber, bill.memo ?? '',
  ))

  for (const line of bill.lines) {
    lines.push(row(
      'SPL', '', 'BILL', formatDate(bill.date), line.account,
      bill.vendorName, bill.currency, formatAmount(line.amount),
      bill.billNumber, line.memo ?? '',
    ))
  }

  lines.push('ENDTRNS')
  return lines
}

/**
 * Generate a complete IIF file. Returns a string (UTF-8, CRLF line endings).
 */
export function generateIIF(payload: IIFPayload): string {
  const out: string[] = []
  const { customers = [], vendors = [], invoices = [], bills = [] } = payload

  // --- AGUILA brand header (IIF comments start with ;) ---
  const company = customers[0]?.companyName ?? customers[0]?.name ?? ''
  const today = new Date().toISOString().slice(0, 10)
  out.push(`; AGUILA — Patente 3596 · ${company} · ${today}`)
  out.push('; Generado por AGUILA · Inteligencia aduanal · Aduana 240 Nuevo Laredo')

  // --- Customers section ---
  if (customers.length > 0) {
    out.push(row('!CUST', 'NAME', 'REFNUM', 'TAXID', 'COMPANYNAME'))
    customers.forEach((c, idx) => {
      out.push(row('CUST', c.name, idx + 1, c.taxId ?? '', c.companyName ?? c.name))
    })
  }

  // --- Vendors section ---
  if (vendors.length > 0) {
    out.push(row('!VEND', 'NAME', 'REFNUM', 'TAXID'))
    vendors.forEach((v, idx) => {
      out.push(row('VEND', v.name, idx + 1, v.taxId ?? ''))
    })
  }

  // --- Transactions section (invoices + bills share the TRNS table) ---
  if (invoices.length > 0 || bills.length > 0) {
    out.push(row(
      '!TRNS', 'TRNSID', 'TRNSTYPE', 'DATE', 'ACCNT',
      'NAME', 'CURRENCY', 'AMOUNT', 'DOCNUM', 'MEMO',
    ))
    out.push(row(
      '!SPL', 'SPLID', 'TRNSTYPE', 'DATE', 'ACCNT',
      'NAME', 'CURRENCY', 'AMOUNT', 'DOCNUM', 'MEMO', 'QNTY',
    ))
    out.push('!ENDTRNS')

    for (const inv of invoices) out.push(...invoiceBlock(inv))
    for (const bill of bills) out.push(...billBlock(bill))
  }

  return out.join(CRLF) + CRLF
}

/**
 * CSV fallback — single flat table with an `entity` discriminator column.
 * Simpler than IIF, useful for clients not on QuickBooks Desktop.
 */
export function generateCSV(payload: IIFPayload): string {
  const rows: string[] = []
  rows.push(['entity', 'name', 'tax_id', 'number', 'date', 'currency', 'amount', 'memo'].join(','))

  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  for (const c of payload.customers ?? []) {
    rows.push(['customer', c.name, c.taxId ?? '', '', '', '', '', c.companyName ?? ''].map(esc).join(','))
  }
  for (const v of payload.vendors ?? []) {
    rows.push(['vendor', v.name, v.taxId ?? '', '', '', '', '', ''].map(esc).join(','))
  }
  for (const inv of payload.invoices ?? []) {
    const total = inv.lines.reduce((s, l) => s + l.amount, 0)
    rows.push([
      'invoice', inv.customerName, '', inv.invoiceNumber,
      inv.date, inv.currency, total.toFixed(2), inv.memo ?? '',
    ].map(esc).join(','))
  }
  for (const bill of payload.bills ?? []) {
    const total = bill.lines.reduce((s, l) => s + l.amount, 0)
    rows.push([
      'bill', bill.vendorName, '', bill.billNumber,
      bill.date, bill.currency, total.toFixed(2), bill.memo ?? '',
    ].map(esc).join(','))
  }

  return rows.join(CRLF) + CRLF
}

/**
 * Count the logical export rows across all entities. Used by the runner to
 * stamp `row_count` on the job record.
 */
export function countRows(payload: IIFPayload): number {
  return (payload.customers?.length ?? 0)
    + (payload.vendors?.length ?? 0)
    + (payload.invoices?.length ?? 0)
    + (payload.bills?.length ?? 0)
}
