/**
 * CRUZ · Block 11 — PECE payment workflow pure logic.
 *
 * State machine: intent → submitted → confirmed. Rejections allowed from
 * intent or submitted. The API routes call these helpers; tests exercise
 * them without Supabase.
 */

import { z } from 'zod'

export type PecePaymentStatus = 'intent' | 'submitted' | 'confirmed' | 'rejected'

export interface PecePaymentTransitionInput {
  from: PecePaymentStatus
  action: 'submit' | 'confirm' | 'reject'
  confirmationNumber?: string
}

export interface PecePaymentTransitionResult {
  to: PecePaymentStatus
  error: null | { code: 'INVALID_TRANSITION' | 'MISSING_CONFIRMATION'; message: string }
}

/**
 * Pure state-machine: given current status and requested action, return next
 * state (or an error). Confirmation requires a confirmation number.
 */
export function transitionPecePayment(
  input: PecePaymentTransitionInput,
): PecePaymentTransitionResult {
  const { from, action, confirmationNumber } = input

  if (action === 'submit') {
    if (from !== 'intent') {
      return {
        to: from,
        error: {
          code: 'INVALID_TRANSITION',
          message: `No se puede marcar como enviado desde estado “${from}”.`,
        },
      }
    }
    return { to: 'submitted', error: null }
  }

  if (action === 'confirm') {
    if (from !== 'submitted' && from !== 'intent') {
      return {
        to: from,
        error: {
          code: 'INVALID_TRANSITION',
          message: `No se puede confirmar pago desde estado “${from}”.`,
        },
      }
    }
    if (!confirmationNumber || confirmationNumber.trim().length === 0) {
      return {
        to: from,
        error: {
          code: 'MISSING_CONFIRMATION',
          message: 'Folio de confirmación requerido.',
        },
      }
    }
    return { to: 'confirmed', error: null }
  }

  // reject
  if (from === 'confirmed' || from === 'rejected') {
    return {
      to: from,
      error: {
        code: 'INVALID_TRANSITION',
        message: `No se puede rechazar pago desde estado “${from}”.`,
      },
    }
  }
  return { to: 'rejected', error: null }
}

/**
 * Zod schema for the create-intent API body. Amount must be strictly
 * positive and <= 9,999,999,999.99 (fits numeric(14,2)).
 */
export const CreatePeceIntentSchema = z.object({
  pedimento_id: z.string().uuid(),
  trafico_id: z.string().min(1).optional(),
  bank_code: z.string().regex(/^\d{3}$/, 'Clave de banco inválida'),
  amount: z
    .number()
    .positive('Monto debe ser mayor a cero')
    .max(9_999_999_999.99, 'Monto excede límite'),
  reference: z.string().min(3, 'Referencia requerida').max(64),
})

export const ConfirmPecePaymentSchema = z.object({
  payment_id: z.string().uuid(),
  action: z.enum(['submit', 'confirm', 'reject']),
  confirmation_number: z.string().min(1).max(64).optional(),
})

/**
 * Derive the workflow_event type for a given transition.
 */
export function eventTypeForTransition(
  from: PecePaymentStatus,
  to: PecePaymentStatus,
): 'pece_payment_intent' | 'pece_payment_confirmed' | null {
  if (from === to) return null
  if (to === 'confirmed') return 'pece_payment_confirmed'
  return null
}

/**
 * The event type fired when an intent is created (no prior state).
 */
export const PECE_INTENT_CREATED_EVENT = 'pece_payment_intent' as const
