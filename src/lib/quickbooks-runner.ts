/**
 * ZAPATA AI · V1.5 F2 — QuickBooks export runner (server-only).
 *
 * Loads a `quickbooks_export_jobs` row, pulls the scoped facturas from
 * `pedimento_facturas`, renders IIF/CSV via `quickbooks-export.ts`, uploads
 * the artifact to the `quickbooks-exports` Storage bucket, and updates the
 * job row. On any failure: `status = 'failed'` with a diagnostic in `error`.
 *
 * If the storage bucket is missing, fail gracefully with `error = 'bucket_missing'`
 * so the UI can render an info banner instead of looking broken.
 */

import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  generateCSV,
  generateIIF,
  countRows,
  type IIFPayload,
  type QBCustomer,
  type QBInvoice,
  type QBVendor,
} from '@/lib/quickbooks-export'

const BUCKET = 'quickbooks-exports'

interface JobRow {
  id: string
  company_id: string
  entity: 'invoices' | 'bills' | 'customers' | 'vendors' | 'all'
  format: 'IIF' | 'CSV'
  date_from: string | null
  date_to: string | null
  status: string
}

interface FacturaRow {
  id: string
  company_id: string | null
  supplier_name: string | null
  supplier_tax_id: string | null
  invoice_number: string | null
  invoice_date: string | null
  currency: string | null
  amount: number | null
  assigned_to_trafico_id: string | null
}

function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function loadJob(supabase: SupabaseClient, jobId: string): Promise<JobRow | null> {
  const { data } = await supabase
    .from('quickbooks_export_jobs')
    .select('id, company_id, entity, format, date_from, date_to, status')
    .eq('id', jobId)
    .maybeSingle<JobRow>()
  return data
}

async function loadFacturas(
  supabase: SupabaseClient,
  job: JobRow,
): Promise<FacturaRow[]> {
  let q = supabase
    .from('pedimento_facturas')
    .select('id, company_id, supplier_name, supplier_tax_id, invoice_number, invoice_date, currency, amount, assigned_to_trafico_id')
    .eq('company_id', job.company_id)
    .limit(5000)

  if (job.date_from) q = q.gte('invoice_date', job.date_from)
  if (job.date_to) q = q.lte('invoice_date', job.date_to)

  const { data, error } = await q
  if (error) throw new Error(`load_facturas: ${error.message}`)
  return (data ?? []) as FacturaRow[]
}

function buildPayload(
  job: JobRow,
  facturas: FacturaRow[],
): IIFPayload {
  const currency = (c: string | null): 'MXN' | 'USD' =>
    (c?.toUpperCase() === 'USD' ? 'USD' : 'MXN')

  const invoices: QBInvoice[] = facturas
    .filter(f => f.invoice_number && f.invoice_date)
    .map(f => ({
      invoiceNumber: f.invoice_number!,
      date: f.invoice_date!,
      customerName: f.supplier_name ?? 'Cliente sin nombre',
      currency: currency(f.currency),
      memo: f.assigned_to_trafico_id ? `Embarque ${f.assigned_to_trafico_id}` : null,
      lines: [{
        account: 'Ingresos:Servicios aduanales',
        amount: Number(f.amount ?? 0),
        memo: f.invoice_number ?? null,
      }],
    }))

  // Dedupe customer + vendor names for reference sections.
  const customerMap = new Map<string, QBCustomer>()
  const vendorMap = new Map<string, QBVendor>()
  for (const f of facturas) {
    if (!f.supplier_name) continue
    if (!customerMap.has(f.supplier_name)) {
      customerMap.set(f.supplier_name, {
        name: f.supplier_name,
        taxId: f.supplier_tax_id,
        companyName: f.supplier_name,
      })
    }
    if (!vendorMap.has(f.supplier_name)) {
      vendorMap.set(f.supplier_name, {
        name: f.supplier_name,
        taxId: f.supplier_tax_id,
      })
    }
  }

  const customers = Array.from(customerMap.values())
  const vendors = Array.from(vendorMap.values())

  switch (job.entity) {
    case 'customers': return { customers }
    case 'vendors': return { vendors }
    case 'invoices': return { customers, invoices }
    case 'bills': return { vendors, bills: [] }
    case 'all':
    default:
      return { customers, vendors, invoices, bills: [] }
  }
}

function filePath(companyId: string, jobId: string, format: 'IIF' | 'CSV'): string {
  const year = new Date().getUTCFullYear()
  const ext = format === 'IIF' ? 'iif' : 'csv'
  return `${companyId}/${year}/${jobId}.${ext}`
}

async function markRunning(supabase: SupabaseClient, jobId: string) {
  await supabase
    .from('quickbooks_export_jobs')
    .update({ status: 'running' })
    .eq('id', jobId)
}

async function markFailed(supabase: SupabaseClient, jobId: string, reason: string) {
  await supabase
    .from('quickbooks_export_jobs')
    .update({
      status: 'failed',
      error: reason.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

async function markReady(
  supabase: SupabaseClient,
  jobId: string,
  path: string,
  bytes: number,
  rows: number,
) {
  await supabase
    .from('quickbooks_export_jobs')
    .update({
      status: 'ready',
      file_path: path,
      file_bytes: bytes,
      row_count: rows,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

async function logUsageEvent(
  supabase: SupabaseClient,
  job: JobRow,
  rows: number,
) {
  // Server-side telemetry write. We do NOT widen the client-side
  // TelemetryEvent union; this event lives in metadata per plan guidance.
  await supabase.from('interaction_events').insert({
    event_type: 'quickbooks_export_completed',
    event_name: 'quickbooks_export_completed',
    page_path: '/admin/quickbooks-export',
    user_id: `${job.company_id}:system`,
    company_id: job.company_id,
    entity_type: 'quickbooks_export_jobs',
    entity_id: job.id,
    payload: {
      event: 'quickbooks_export_completed',
      entity: job.entity,
      format: job.format,
      rows,
    },
  })
}

export async function runExportJob(jobId: string): Promise<void> {
  const supabase = getServiceClient()
  const job = await loadJob(supabase, jobId)
  if (!job) throw new Error(`job_not_found: ${jobId}`)

  await markRunning(supabase, jobId)

  try {
    const facturas = await loadFacturas(supabase, job)
    const payload = buildPayload(job, facturas)
    const contents = job.format === 'IIF' ? generateIIF(payload) : generateCSV(payload)
    const rows = countRows(payload)
    const path = filePath(job.company_id, job.id, job.format)

    const body = new Blob([contents], {
      type: job.format === 'IIF' ? 'application/octet-stream' : 'text/csv',
    })

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, { upsert: true, contentType: body.type })

    if (upErr) {
      const msg = upErr.message || 'upload_failed'
      const reason = /bucket.*not.*found|not_found|Bucket not found/i.test(msg)
        ? 'bucket_missing'
        : `upload_failed: ${msg}`
      await markFailed(supabase, jobId, reason)
      return
    }

    await markReady(supabase, jobId, path, contents.length, rows)
    await logUsageEvent(supabase, job, rows)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await markFailed(supabase, jobId, msg)
  }
}

export async function signedDownloadURL(filePath: string): Promise<string | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60 * 10) // 10 minutes
  if (error || !data) return null
  return data.signedUrl
}
