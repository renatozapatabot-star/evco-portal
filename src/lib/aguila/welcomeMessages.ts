/**
 * Role-scoped ZAPATA AI greeting messages. Shown as the assistant's first
 * message when the user opens the chat from a role cockpit. Spanish primary,
 * ≤2 sentences, action-oriented.
 *
 * Consumed by /asistente → /cruz via the `?role=` query param.
 */

export type AguilaWelcomeRole =
  | 'trafico' | 'contabilidad' | 'warehouse' | 'owner' | 'client' | 'operator'

export const ZAPATA_WELCOME_MESSAGES: Record<AguilaWelcomeRole, string> = {
  trafico:
    'Hola Claudia. Soy ZAPATA AI. ¿Quieres ver tus embarques atrasados, vincular un pedimento a una entrada, o revisar la cola?',
  contabilidad:
    'Hola Anabel. Soy ZAPATA AI. ¿Buscas facturas por cobrar, pagos por aplicar, o listo para exportar a QuickBooks?',
  warehouse:
    'Hola Vicente. Soy ZAPATA AI. ¿Vas a recibir una entrada, asignar ubicación, o autorizar una salida?',
  owner:
    'Hola Tito. Soy ZAPATA AI. ¿Qué quieres revisar — drafts, eagle view, o el ritmo del día?',
  operator:
    'Hola. Soy ZAPATA AI. ¿En qué te ayudo?',
  client:
    'Hola. Soy ZAPATA AI, el asistente de Renato Zapata & Company. ¿En qué te ayudo?',
}

export function welcomeFor(role: string | null | undefined): string {
  if (!role) return ZAPATA_WELCOME_MESSAGES.client
  return ZAPATA_WELCOME_MESSAGES[role as AguilaWelcomeRole] ?? ZAPATA_WELCOME_MESSAGES.client
}
