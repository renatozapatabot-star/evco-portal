import { FileText } from 'lucide-react'
import { BORDER, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'
import { DocUploader } from '@/components/docs/DocUploader'
import { DocTypePill } from '@/components/docs/DocTypePill'

export interface DocRow {
  id?: string
  document_type?: string | null
  document_type_confidence?: number | null
  doc_type?: string | null
  file_name?: string | null
  created_at?: string | null
}

export function DocumentosTab({ docs, traficoId }: { docs: DocRow[]; traficoId: string }) {
  // Block 10 (ExpedienteChecklist) will mount above the uploader later.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <DocUploader traficoId={traficoId} />

      {docs.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            padding: '24px 16px',
            color: TEXT_MUTED,
          }}
        >
          <FileText size={24} />
          <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>Sin documentos en el expediente</div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, textAlign: 'center', maxWidth: 320 }}>
            Arrastra una factura, packing list o certificado de origen arriba para iniciar el expediente.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {docs.map((d, i) => {
            const displayType = d.document_type || d.doc_type || 'pending'
            const confidence = typeof d.document_type_confidence === 'number' ? d.document_type_confidence : null
            return (
              <div
                key={d.id ?? `${d.file_name}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: i < docs.length - 1 ? `1px solid ${BORDER}` : 'none',
                  minHeight: 60,
                }}
              >
                <FileText size={16} style={{ color: TEXT_MUTED, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: TEXT_PRIMARY,
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.file_name || displayType}
                  </div>
                  {d.created_at && (
                    <div
                      style={{
                        fontSize: 11,
                        color: TEXT_MUTED,
                        marginTop: 2,
                        fontFamily: 'var(--font-jetbrains-mono)',
                      }}
                    >
                      {fmtDateTime(d.created_at)}
                    </div>
                  )}
                </div>
                {d.id && (
                  <DocTypePill documentId={d.id} currentType={displayType} confidence={confidence} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
