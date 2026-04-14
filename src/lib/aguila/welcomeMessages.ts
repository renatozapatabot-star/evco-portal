/**
 * Role-scoped AGUILA AI greeting messages. Shown as the assistant's first
 * message when the user opens the chat from a role cockpit. Spanish primary,
 * ≤2 sentences, action-oriented.
 *
 * Consumed by /asistente → /cruz via the `?role=` query param.
 */

export type AguilaWelcomeRole =
  | 'trafico' | 'contabilidad' | 'warehouse' | 'owner' | 'client' | 'operator'

export const AGUILA_WELCOME_MESSAGES: Record<AguilaWelcomeRole, string> = {
  trafico:
    'Hola Claudia. Soy AGUILA. ¿Quieres ver tus embarques atrasados, vincular un pedimento a una entrada, o revisar la cola?',
  contabilidad:
    'Hola Anabel. Soy AGUILA. ¿Buscas facturas por cobrar, pagos por aplicar, o listo para exportar a QuickBooks?',
  warehouse:
    'Hola Vicente. Soy AGUILA. ¿Vas a recibir una entrada, asignar ubicación, o autorizar una salida?',
  owner:
    'Hola Tito. Soy AGUILA. ¿Qué quieres revisar — drafts, eagle view, o el ritmo del día?',
  operator:
    'Hola. Soy AGUILA. ¿En qué te ayudo?',
  client:
    'Hola. Soy AGUILA, el asistente de Renato Zapata & Company. ¿En qué te ayudo?',
}

export function welcomeFor(role: string | null | undefined): string {
  if (!role) return AGUILA_WELCOME_MESSAGES.client
  return AGUILA_WELCOME_MESSAGES[role as AguilaWelcomeRole] ?? AGUILA_WELCOME_MESSAGES.client
}
