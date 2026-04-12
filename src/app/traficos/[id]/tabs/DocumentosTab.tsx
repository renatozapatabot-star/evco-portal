'use client'

import { useRef, useState } from 'react'
import { FileText, MailPlus } from 'lucide-react'
import { BORDER, GOLD, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'
import { DocUploader } from '@/components/docs/DocUploader'
import { DocTypePill } from '@/components/docs/DocTypePill'
import { ExpedienteChecklist } from '@/components/docs/ExpedienteChecklist'
import { SolicitarDocsModal } from '@/components/trafico/SolicitarDocsModal'
import { getRequiredDocs, type DocType } from '@/lib/doc-requirements'
import type { DocRow } from '../types'

interface DocumentosTabProps {
  traficoId: string
  docs: DocRow[]
  regimen: string | null
  cliente: string
  proveedor: string | null
  operatorName: string
  missingDocs: DocType[]
}

export function DocumentosTab({
  traficoId,
  docs,
  regimen,
  cliente,
  proveedor,
  operatorName,
  missingDocs,
}: DocumentosTabProps) {
  const uploaderRef = useRef<HTMLDivElement | null>(null)
  const [defaultDocType, setDefaultDocType] = useState<DocType | undefined>(undefined)
  const [modalOpen, setModalOpen] = useState(false)
  const requiredDocs = getRequiredDocs(regimen)

  function handleMissingDocClick(docType: DocType) {
    setDefaultDocType(docType)
    if (uploaderRef.current) {
      uploaderRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const button = uploaderRef.current.querySelector<HTMLElement>('[role="button"]')
      if (button) window.setTimeout(() => button.focus(), 250)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ExpedienteChecklist
        requiredDocs={requiredDocs}
        uploadedDocs={docs}
        onMissingDocClick={handleMissingDocClick}
      />

      <div ref={uploaderRef}>
        <DocUploader traficoId={traficoId} defaultDocType={defaultDocType} />
      </div>

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        disabled={missingDocs.length === 0}
        style={{
          minHeight: 60,
          padding: '0 20px',
          background: missingDocs.length === 0 ? 'rgba(234,179,8,0.35)' : GOLD,
          color: '#0B1220',
          border: 'none',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 700,
          cursor: missingDocs.length === 0 ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          letterSpacing: '0.02em',
        }}
      >
        <MailPlus size={14} />
        {missingDocs.length === 0
          ? 'Expediente completo'
          : `Solicitar ${missingDocs.length} documento${missingDocs.length === 1 ? '' : 's'} faltante${missingDocs.length === 1 ? '' : 's'}`}
      </button>

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
          <div
            style={{
              fontSize: 11,
              color: TEXT_MUTED,
              textAlign: 'center',
              maxWidth: 320,
            }}
          >
            Arrastra una factura, packing list o certificado de origen arriba para iniciar el expediente.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {docs.map((d, i) => {
            const displayType = d.document_type || d.doc_type || 'pending'
            const confidence =
              typeof d.document_type_confidence === 'number' ? d.document_type_confidence : null
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
                  <DocTypePill
                    documentId={d.id}
                    currentType={displayType}
                    confidence={confidence}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <SolicitarDocsModal
          traficoId={traficoId}
          cliente={cliente}
          proveedor={proveedor}
          missingDocs={missingDocs}
          operatorName={operatorName}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
