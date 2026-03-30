import { createClient } from '@supabase/supabase-js'

export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function getAllDocuments(traficoId: string) {
  const supabase = createServerClient()
  const [d1, d2] = await Promise.all([
    supabase.from('documents')
      .select('*').eq('trafico_id', traficoId),
    supabase.from('expediente_documentos')
      .select('*').eq('trafico_id', traficoId)
  ])
  const all = [...(d1.data || []), ...(d2.data || [])]
  const unique = all.filter((d, i, arr) =>
    arr.findIndex(x => x.file_url === d.file_url) === i
  )
  return unique
}
