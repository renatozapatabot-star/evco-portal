import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCompanyIdCookie } from '@/lib/client-config'

const BASE = 'CRUZ · Customs Intelligence'

export function useTabTitle() {
  useEffect(() => {
    const supabase = createClient()
    const companyId = getCompanyIdCookie()
    async function update() {
      try {
        const { count } = await supabase
          .from('trafico_actions')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .in('primary_action', ['SEMAFORO_ROJO', 'SIN_DOCUMENTOS'])
        document.title = count && count > 0 ? `(${count}) ${BASE}` : BASE
      } catch {
        document.title = BASE
      }
    }
    update()
    const t = setInterval(update, 7_200_000) // 2 hours
    return () => { clearInterval(t); document.title = BASE }
  }, [])
}
