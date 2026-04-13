/**
 * AGUILA · V1.5 F12 — Telegram message formatters (es-MX).
 *
 * One formatter per routable event kind. Pure functions: given a payload,
 * return a fully formatted Spanish string with emoji. No Supabase, no I/O.
 *
 * Every formatter handles missing fields gracefully with "—" fallbacks —
 * we never fail a dispatch because one payload key was null.
 */

export type FormatterPayload = Record<string, unknown>

const dash = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

const fmtMoney = (amount: unknown, currency: unknown): string => {
  if (amount === null || amount === undefined || amount === '') return '—'
  const num = typeof amount === 'number' ? amount : Number(amount)
  if (!Number.isFinite(num)) return dash(amount)
  const cur = typeof currency === 'string' && currency ? currency : 'MXN'
  return `${num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`
}

const fmtTime = (ts: unknown): string => {
  if (!ts) return '—'
  try {
    const d = new Date(String(ts))
    return d.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Chicago',
    })
  } catch {
    return '—'
  }
}

export function formatTraficoCompleted(payload: FormatterPayload): string {
  const trafico = dash(payload.trafico_id ?? payload.trafico ?? payload.trafico_number)
  const cliente = dash(payload.client_name ?? payload.clave_cliente ?? payload.company_id)
  const crossed = fmtTime(payload.crossed_at ?? payload.completed_at ?? payload.created_at)
  const total = fmtMoney(payload.total_amount ?? payload.total, payload.currency)
  const operator = dash(payload.operator_name ?? payload.operator ?? payload.actor)
  const next = dash(payload.next_action ?? 'ninguna')
  return (
    `✅ Embarque ${trafico} (${cliente}) cruzó semáforo verde a las ${crossed}. ` +
    `Total: ${total}. Operador: ${operator}. Próxima acción: ${next}.`
  )
}

export function formatFacturaIssued(payload: FormatterPayload): string {
  const num = dash(payload.invoice_number ?? payload.number)
  const cliente = dash(payload.client_name ?? payload.company_id)
  const amount = fmtMoney(payload.amount, payload.currency)
  return `📄 Factura ${num} emitida para ${cliente}. Monto: ${amount}.`
}

export function formatPecePaymentConfirmed(payload: FormatterPayload): string {
  const pedimento = dash(payload.pedimento_number ?? payload.pedimento)
  const amount = fmtMoney(payload.amount, payload.currency)
  const bank = dash(payload.bank_name ?? payload.bank)
  return `💳 Pago PECE confirmado para pedimento ${pedimento}. ${amount} vía ${bank}.`
}

export function formatDormantClientDetected(payload: FormatterPayload): string {
  const cliente = dash(payload.client_name ?? payload.company_id ?? payload.clave_cliente)
  const days = dash(payload.days_dormant ?? payload.dias)
  return `🔔 Cliente dormido detectado: ${cliente}. ${days} días sin actividad.`
}

export function formatSemaforoVerde(payload: FormatterPayload): string {
  const trafico = dash(payload.trafico_id ?? payload.trafico)
  const lane = dash(payload.lane ?? payload.carril)
  const bridge = dash(payload.bridge ?? payload.puente)
  return `🟢 Semáforo verde · Embarque ${trafico} · Puente ${bridge} · Carril ${lane}.`
}

export function formatMveAlertRaised(payload: FormatterPayload): string {
  const pedimento = dash(payload.pedimento_number ?? payload.pedimento_id)
  const days = dash(payload.days_remaining)
  const severity = dash(payload.severity ?? 'warning')
  return `⚠️ MVE ${String(severity).toUpperCase()}: pedimento ${pedimento} · ${days} días restantes.`
}

export function formatDefault(eventKind: string, payload: FormatterPayload): string {
  const trafico = payload.trafico_id ?? payload.trigger_id
  const suffix = trafico ? ` · ${dash(trafico)}` : ''
  return `🔔 Evento: ${eventKind}${suffix}`
}

export const EVENT_KIND_LABELS: Record<string, string> = {
  trafico_completed: 'Embarque cruzó',
  factura_issued: 'Factura emitida',
  pece_payment_confirmed: 'Pago PECE confirmado',
  dormant_client_detected: 'Cliente dormido',
  semaforo_verde: 'Semáforo verde',
  mve_alert_raised: 'Alerta MVE',
}

export const ROUTABLE_EVENT_KINDS: ReadonlyArray<string> = [
  'trafico_completed',
  'factura_issued',
  'pece_payment_confirmed',
  'dormant_client_detected',
  'semaforo_verde',
  'mve_alert_raised',
]

export function formatForEvent(eventKind: string, payload: FormatterPayload): string {
  switch (eventKind) {
    case 'trafico_completed':
      return formatTraficoCompleted(payload)
    case 'factura_issued':
      return formatFacturaIssued(payload)
    case 'pece_payment_confirmed':
      return formatPecePaymentConfirmed(payload)
    case 'dormant_client_detected':
      return formatDormantClientDetected(payload)
    case 'semaforo_verde':
      return formatSemaforoVerde(payload)
    case 'mve_alert_raised':
      return formatMveAlertRaised(payload)
    default:
      return formatDefault(eventKind, payload)
  }
}
