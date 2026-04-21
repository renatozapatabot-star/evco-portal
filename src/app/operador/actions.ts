'use server'

import { createClient } from '@supabase/supabase-js'
import { logOperatorAction } from '@/lib/operator-actions'
import { revalidatePath } from 'next/cache'

export async function asignarTrafico(formData: FormData) {
  const traficoId = formData.get('traficoId') as string
  const operatorId = formData.get('operatorId') as string
  if (!traficoId || !operatorId) return

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await sb.from('traficos').update({ assigned_to_operator_id: operatorId }).eq('id', traficoId)

  logOperatorAction({
    operatorId,
    actionType: 'assign_trafico',
    targetTable: 'traficos',
    targetId: traficoId,
  })

  revalidatePath('/operador')
}

export async function liberarTrafico(formData: FormData) {
  const traficoId = formData.get('traficoId') as string
  const operatorId = formData.get('operatorId') as string
  if (!traficoId) return

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await sb.from('traficos').update({ assigned_to_operator_id: null }).eq('id', traficoId)

  logOperatorAction({
    operatorId,
    actionType: 'release_trafico',
    targetTable: 'traficos',
    targetId: traficoId,
  })

  revalidatePath('/operador')
}
