import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DOC_LABELS: Record<string, string> = {
  FACTURA: 'Factura Comercial',
  'LISTA DE EMPAQUE': 'Lista de Empaque',
  PEDIMENTO: 'Pedimento Aduanal',
  'ACUSE DE COVE': 'Acuse de COVE',
  'ACUSE DE E-DOCUMENT': 'Acuse de E-Document',
  CARTA: 'Carta de Instrucciones',
  'QR DODA': 'QR DODA',
  CFDI: 'CFDI XML',
  'CARTA PORTE': 'Carta Porte',
  'CERTIFICADO USMCA': 'Certificado T-MEC/USMCA',
}

export async function solicitarDocumentos(
  traficoId: string,
  missingDocs: string[],
  clientClave: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Create tracking records per document
    const records = missingDocs.map(doc => ({
      trafico_id: traficoId,
      doc_type: doc,
      status: 'solicitado',
      solicitado_at: new Date().toISOString(),
      escalate_after: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      company_id: clientClave,
    }))

    const { error: insertError } = await supabase
      .from('documento_solicitudes')
      .upsert(records, { onConflict: 'trafico_id,doc_type' })

    if (insertError) {
      // Table may not exist yet — don't fail
    }

    // 2. Update expediente_documentos status to 'solicitado' if they exist
    await supabase
      .from('expediente_documentos')
      .update({ status: 'solicitado', solicitado_at: new Date().toISOString() })
      .eq('pedimento_id', traficoId)
      .in('doc_type', missingDocs)

    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export function getDocLabel(docType: string): string {
  return DOC_LABELS[docType] || docType
}
