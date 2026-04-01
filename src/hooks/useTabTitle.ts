import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'evco'
const BASE = 'CRUZ · Customs Intelligence'

export function useTabTitle() {
  useEffect(() => {
    const supabase = createClient()
    async function update() {
      try {
        const { count } = await supabase
          .from('trafico_actions')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', COMPANY_ID)
          .in('primary_action', ['SEMAFORO_ROJO', 'SIN_DOCUMENTOS'])
        document.title = count && count > 0 ? `(${count}) ${BASE}` : BASE
      } catch {
        document.title = BASE
      }
    }
    update()
    const t = setInterval(update, 30000)
    return () => { clearInterval(t); document.title = BASE }
  }, [])
}
