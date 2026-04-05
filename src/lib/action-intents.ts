/**
 * CRUZ Action Intents — Natural Language Operations
 *
 * Everyone interacts with CRUZ in natural language.
 * No forms. No dropdowns. No config screens.
 * The conversation IS the interface.
 */

export type ActionIntent =
  | 'solicit_documents'
  | 'share_tracking'
  | 'generate_report'
  | 'send_notification'
  | 'schedule_crossing'

export interface ActionConfirmation {
  intent: ActionIntent
  description: string
  requiresApproval: boolean
  data: Record<string, unknown>
}

/**
 * Detect if a user message is asking CRUZ to DO something
 * (vs just asking for information). Used by the system prompt
 * to guide the AI's response style.
 */
export function isActionIntent(message: string): boolean {
  const actionVerbs = [
    'solicita', 'envía', 'envia', 'manda', 'genera', 'crea',
    'comparte', 'prepara', 'programa', 'cruza', 'sube',
    'notifica', 'avisa', 'recuerda', 'actualiza', 'cambia',
    'aprueba', 'rechaza', 'cancela', 'pide', 'solicitar',
    'enviar', 'mandar', 'generar', 'crear', 'compartir',
    'preparar', 'programar', 'cruzar', 'subir', 'notificar',
  ]

  const lower = message.toLowerCase()
  return actionVerbs.some(v => lower.includes(v))
}

/**
 * Detect if a user message is confirming a previous action proposal.
 */
export function isConfirmation(message: string): boolean {
  const confirmWords = [
    'sí', 'si', 'dale', 'procede', 'adelante', 'ok', 'está bien',
    'esta bien', 'confirmo', 'hazlo', 'ejecuta', 'aprobado',
    'claro', 'por favor', 'va', 'órale', 'orale',
  ]

  const lower = message.toLowerCase().trim()
  return confirmWords.some(w => lower === w || lower.startsWith(w + ' ') || lower.startsWith(w + ','))
}
