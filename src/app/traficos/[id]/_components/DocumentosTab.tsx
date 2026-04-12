import { FileText } from 'lucide-react'
import { BORDER, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/design-system'

export interface DocRow {
  id?: string
  document_type?: string | null
  doc_type?: string | null
  file_name?: string | null
  created_at?: string | null
}

export function DocumentosTab({ docs }: { docs: DocRow[] }) {
  // TODO(Block 3): mount <DocUploader traficoId={...} /> here. The uploader
  // drives Claude vision classification and writes to expediente_documentos.
  // TODO(Block 10): mount <ExpedienteChecklist regimen={...} docs={docs} />
  // above the uploader to show required-vs-present at a glance.

  if (docs.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          padding: '32px 16px',
          color: TEXT_MUTED,
        }}
      >
        <FileText size={24} />
        <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>Sin documentos en el expediente</div>
        <div style={{ fontSize: 11, color: TEXT_MUTED, textAlign: 'center', maxWidth: 320 }}>
          El cargador de documentos estará disponible próximamente (Bloque 3 del V1 Polish Pack).
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {docs.map((d, i) => {
        const type = (d.document_type || d.doc_type || 'documento').replace(/_/g, ' ')
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
                {d.file_name || type}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: TEXT_MUTED,
                  textTransform: 'capitalize',
                  marginTop: 2,
                }}
              >
                {type}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
