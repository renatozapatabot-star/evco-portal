/**
 * CRUZ · V1.5 F9 — One-Click Demo Orchestrator
 *
 * Seeds a synthetic end-to-end embarque and walks it through 12 lifecycle
 * events over ~90 seconds. Each step writes to Supabase (workflow_events +
 * a handful of domain tables) so the portal lights up as if a real shipment
 * were moving through the corridor.
 *
 * Status is tracked in an in-memory `demoRuns` Map keyed by runId. This is
 * acceptable for demo-scale and a single Node worker. If Vercel routes the
 * /status poll to a different lambda instance, the poll returns `unknown`
 * and the UI falls back to the completed steps list in the DB.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const DEMO_COMPANY_ID = 'aguila-demo'
export const DEMO_COMPANY_NAME = 'DEMO EVCO PLASTICS'
export const DEMO_RFC = 'DEMO010101DEM'
const STEP_DELAY_MS = 4_000 // ~4s × 12 steps = ~48s; add padding for DB writes → ≈90s

export interface DemoStep {
  id: number
  key: string
  label: string
  status: 'pending' | 'running' | 'done' | 'failed'
  at?: string
  detail?: string
}

export interface DemoRun {
  runId: string
  companyId: string
  traficoId: string
  startedAt: string
  currentStep: number
  steps: DemoStep[]
  error?: string
  finishedAt?: string
}

// Module-scoped run registry. Sufficient for demo mode.
const demoRuns = new Map<string, DemoRun>()

export function getDemoRun(runId: string): DemoRun | null {
  return demoRuns.get(runId) ?? null
}

export function listDemoRuns(): DemoRun[] {
  return Array.from(demoRuns.values())
}

const STEP_DEFS: Array<{ key: string; label: string }> = [
  { key: 'supplier_confirmed',          label: 'Proveedor confirma embarque' },
  { key: 'partidas_seeded',             label: 'Se generan 3 partidas con fracciones' },
  { key: 'classification_sheet_generated', label: 'Hoja de clasificación lista' },
  { key: 'warehouse_received',          label: 'Recepción en bodega RZ' },
  { key: 'pedimento_drafted',           label: 'Pedimento redactado' },
  { key: 'pedimento_exported',          label: 'Pedimento exportado a AduanaNet' },
  { key: 'pece_payment_registered',     label: 'Pago PECE registrado' },
  { key: 'semaforo_verde',              label: 'Semáforo verde asignado' },
  { key: 'anexo_24_ready',              label: 'Anexo 24 generado' },
  { key: 'mve_alert_lifecycle',         label: 'Alerta MVE levantada y resuelta' },
  { key: 'invoice_issued',              label: 'Factura RZ emitida' },
  { key: 'quickbooks_job_ready',        label: 'Exportación QuickBooks lista' },
]

export function isoNow(): string {
  return new Date().toISOString()
}

export function makeTraficoRef(prefix = 'DEMO'): string {
  const stamp = Date.now().toString(36).slice(-6).toUpperCase()
  return `${prefix}-${stamp}`
}

/**
 * Insert the synthetic company row if it doesn't already exist. Idempotent.
 */
export async function ensureDemoCompany(sb: SupabaseClient): Promise<void> {
  const { data: existing } = await sb
    .from('companies')
    .select('company_id')
    .eq('company_id', DEMO_COMPANY_ID)
    .maybeSingle()

  if (existing) return

  await sb.from('companies').insert({
    company_id: DEMO_COMPANY_ID,
    name: DEMO_COMPANY_NAME,
    patente: '3596',
    aduana: '240',
    active: true,
    fiscal: { rfc: DEMO_RFC, regimen_fiscal: '601' },
  })
}

/**
 * Refuse to start a new demo if a prior synthetic embarque for this cliente
 * still exists. The UI surfaces the suggestion to reset first.
 */
export async function assertNoExistingDemoTrafico(sb: SupabaseClient): Promise<void> {
  const { data } = await sb
    .from('traficos')
    .select('trafico')
    .eq('company_id', DEMO_COMPANY_ID)
    .limit(1)

  if (data && data.length > 0) {
    throw new Error('Ya existe un embarque demo. Ejecuta reiniciar demo antes de volver a iniciar.')
  }
}

export async function createDemoTrafico(sb: SupabaseClient): Promise<string> {
  const trafico = makeTraficoRef()
  const { error } = await sb.from('traficos').insert({
    trafico,
    company_id: DEMO_COMPANY_ID,
    estatus: 'En Proceso',
    descripcion_mercancia: 'DEMO · Resina polietileno + conectores plásticos',
    importe_total: 185_000,
    semaforo: 'verde',
    aduana: '240',
    patente: '3596',
  })
  if (error) throw new Error(`No se pudo crear embarque demo: ${error.message}`)
  return trafico
}

interface StepContext {
  sb: SupabaseClient
  run: DemoRun
}

async function fireEvent(sb: SupabaseClient, trafico: string, eventType: string, workflow = 'intake', payload: Record<string, unknown> = {}) {
  await sb.from('workflow_events').insert({
    workflow,
    event_type: eventType,
    trigger_id: trafico,
    company_id: DEMO_COMPANY_ID,
    payload: { ...payload, demo: true },
    status: 'completed',
    completed_at: isoNow(),
  })
}

async function logTelemetry(sb: SupabaseClient, eventName: string, metadata: Record<string, unknown>) {
  await sb.from('interaction_events').insert({
    event_type: eventName,
    event_name: eventName,
    page_path: '/admin/demo',
    user_id: `${DEMO_COMPANY_ID}:admin`,
    company_id: DEMO_COMPANY_ID,
    payload: { event: eventName, ...metadata },
  })
}

/**
 * Step runners — each writes minimally to reflect the lifecycle without
 * triggering FK/ownership traps. Steps that require a real pedimento FK
 * degrade to a workflow_event only.
 */
const STEP_RUNNERS: Record<string, (ctx: StepContext) => Promise<string | undefined>> = {
  supplier_confirmed: async ({ sb, run }) => {
    await fireEvent(sb, run.traficoId, 'supplier_confirmed', 'intake', {
      supplier: 'DEMO PLASTICS SUPPLIER INC',
      etd: isoNow(),
    })
    return 'Embarque confirmado por proveedor.'
  },
  partidas_seeded: async ({ sb, run }) => {
    await fireEvent(sb, run.traficoId, 'partidas_seeded', 'classify', {
      partidas: [
        { fraccion: '3901.10.01', descripcion: 'Polietileno baja densidad', valor_usd: 48_500 },
        { fraccion: '3902.20.02', descripcion: 'Polipropileno granulado',   valor_usd: 41_200 },
        { fraccion: '3903.30.03', descripcion: 'Copolímero acrilonitrilo',  valor_usd: 18_900 },
      ],
    })
    return '3 partidas sembradas con fracciones reales.'
  },
  classification_sheet_generated: async ({ sb, run }) => {
    const { error } = await sb.from('classification_sheets').insert({
      trafico_id: run.traficoId,
      cliente_id: DEMO_COMPANY_ID,
      company_id: DEMO_COMPANY_ID,
      generated_by: 'aguila-demo',
      config: { grouping_mode: 'fraction_umc_country', demo: true },
      partidas_count: 3,
      total_value: 108_600,
    })
    if (error) {
      // fall back to event if table shape drifted
      await fireEvent(sb, run.traficoId, 'classification_sheet_generated', 'classify')
      return 'Evento de hoja emitido (tabla no disponible).'
    }
    await fireEvent(sb, run.traficoId, 'classification_sheet_generated', 'classify')
    return 'Hoja de clasificación registrada.'
  },
  warehouse_received: async ({ sb, run }) => {
    await fireEvent(sb, run.traficoId, 'warehouse_received', 'docs', {
      location: 'RZ_WAREHOUSE',
      bultos: 48,
      peso_kg: 21_340,
    })
    return 'Pulso en corredor: bodega RZ.'
  },
  pedimento_drafted: async ({ sb, run }) => {
    await fireEvent(sb, run.traficoId, 'pedimento_drafted', 'pedimento', {
      pedimento_number: '26 24 3596 9999001',
    })
    return 'Borrador pedimento listo.'
  },
  pedimento_exported: async ({ sb, run }) => {
    await fireEvent(sb, run.traficoId, 'pedimento_exported', 'pedimento', {
      target: 'AduanaNet',
      format_version: 'v2',
    })
    return 'Transferido a AduanaNet (placeholder).'
  },
  pece_payment_registered: async ({ sb, run }) => {
    // PECE requires a real pedimento_id FK — fire the workflow event only.
    await fireEvent(sb, run.traficoId, 'pece_payment_registered', 'pedimento', {
      amount_mxn: 342_118.5,
      bank_code: 'BANORTE',
      status: 'pending',
    })
    return 'Intento de pago PECE registrado.'
  },
  semaforo_verde: async ({ sb, run }) => {
    await fireEvent(sb, run.traficoId, 'semaforo_verde', 'crossing')
    return 'Semáforo verde. Cruza sin revisión.'
  },
  anexo_24_ready: async ({ sb, run }) => {
    await fireEvent(sb, run.traficoId, 'anexo_24_ready', 'post_op', {
      format: 'CSV',
      row_count: 3,
    })
    return 'Anexo 24 generado (placeholder).'
  },
  mve_alert_lifecycle: async ({ sb, run }) => {
    await fireEvent(sb, run.traficoId, 'mve_alert_raised', 'post_op', { severity: 'warning' })
    await new Promise((r) => setTimeout(r, STEP_DELAY_MS))
    await fireEvent(sb, run.traficoId, 'mve_alert_resolved', 'post_op', { severity: 'warning' })
    return 'Alerta MVE levantada y resuelta.'
  },
  invoice_issued: async ({ sb, run }) => {
    const invoice_number = `RZ-DEMO-${Date.now().toString(36).slice(-5).toUpperCase()}`
    const { error } = await sb.from('invoices').insert({
      invoice_number,
      company_id: DEMO_COMPANY_ID,
      subtotal: 4_800,
      iva: 768,
      total: 5_568,
      currency: 'MXN',
      status: 'sent',
      notes: 'Demo orquestado CRUZ · embarque sintético',
    })
    if (error) {
      await fireEvent(sb, run.traficoId, 'invoice_issued', 'invoice')
      return 'Evento de factura emitido (tabla no disponible).'
    }
    await fireEvent(sb, run.traficoId, 'invoice_issued', 'invoice', { invoice_number })
    return `Factura ${invoice_number} emitida.`
  },
  quickbooks_job_ready: async ({ sb, run }) => {
    await sb.from('quickbooks_export_jobs').insert({
      company_id: DEMO_COMPANY_ID,
      entity: 'invoices',
      format: 'IIF',
      status: 'ready',
      row_count: 1,
      file_bytes: 2048,
    })
    await fireEvent(sb, run.traficoId, 'quickbooks_job_ready', 'invoice')
    return 'Job QuickBooks listo para descarga.'
  },
}

export async function runOrchestrator(sb: SupabaseClient, run: DemoRun): Promise<void> {
  demoRuns.set(run.runId, run)
  try {
    await logTelemetry(sb, 'demo_run_started', { runId: run.runId, traficoId: run.traficoId })

    for (let i = 0; i < run.steps.length; i++) {
      const step = run.steps[i]
      step.status = 'running'
      step.at = isoNow()
      run.currentStep = i

      try {
        const runner = STEP_RUNNERS[step.key]
        const detail = runner ? await runner({ sb, run }) : undefined
        step.status = 'done'
        step.detail = detail
        step.at = isoNow()
      } catch (err) {
        step.status = 'failed'
        step.detail = err instanceof Error ? err.message : String(err)
        run.error = step.detail
        break
      }

      if (i < run.steps.length - 1) {
        await new Promise((r) => setTimeout(r, STEP_DELAY_MS))
      }
    }

    // Final capstone event
    await fireEvent(sb, run.traficoId, 'demo_run_completed', 'post_op', {
      runId: run.runId,
      totalSteps: run.steps.length,
    })
    await logTelemetry(sb, 'demo_run_completed', { runId: run.runId, traficoId: run.traficoId })
    run.finishedAt = isoNow()
  } catch (err) {
    run.error = err instanceof Error ? err.message : String(err)
    run.finishedAt = isoNow()
  }
}

export function buildInitialRun(runId: string, traficoId: string): DemoRun {
  return {
    runId,
    companyId: DEMO_COMPANY_ID,
    traficoId,
    startedAt: isoNow(),
    currentStep: 0,
    steps: STEP_DEFS.map((s, i) => ({
      id: i,
      key: s.key,
      label: s.label,
      status: 'pending' as const,
    })),
  }
}

/**
 * Purge synthetic embarques + child rows + QB + invoice rows.
 * Idempotent. Safe to call when nothing exists.
 */
export async function resetDemo(sb: SupabaseClient): Promise<{ deleted: number }> {
  let deleted = 0
  const { data: traficos } = await sb
    .from('traficos')
    .select('trafico')
    .eq('company_id', DEMO_COMPANY_ID)

  const traficoIds = (traficos ?? []).map((t) => t.trafico as string)

  if (traficoIds.length > 0) {
    await sb.from('classification_sheets').delete().in('trafico_id', traficoIds)
    await sb.from('workflow_events').delete().in('trigger_id', traficoIds)
  }
  // company-scoped cleanup (covers anything not joined by trafico ref)
  await sb.from('workflow_events').delete().eq('company_id', DEMO_COMPANY_ID)
  await sb.from('quickbooks_export_jobs').delete().eq('company_id', DEMO_COMPANY_ID)
  await sb.from('invoices').delete().eq('company_id', DEMO_COMPANY_ID)
  await sb.from('mve_alerts').delete().eq('company_id', DEMO_COMPANY_ID)
  const { count } = await sb
    .from('traficos')
    .delete({ count: 'exact' })
    .eq('company_id', DEMO_COMPANY_ID)

  deleted = count ?? traficoIds.length

  // flush in-memory runs
  for (const [id, run] of demoRuns.entries()) {
    if (run.companyId === DEMO_COMPANY_ID) demoRuns.delete(id)
  }

  await logTelemetry(sb, 'demo_reset', { deleted })
  return { deleted }
}
