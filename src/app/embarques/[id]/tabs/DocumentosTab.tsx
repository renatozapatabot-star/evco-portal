'use client'

import { useRef, useState } from 'react'
import { FileText, MailPlus } from 'lucide-react'
import { BORDER, GOLD, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'
import { DocUploader } from '@/components/docs/DocUploader'
import { DocTypePill } from '@/components/docs/DocTypePill'
import { ExpedienteChecklist } from '@/components/docs/ExpedienteChecklist'
import { SolicitarDocsModal } from '@/components/trafico/SolicitarDocsModal'
import { getRequiredDocCodesByRegimen, type DocType } from '@/lib/doc-requirements'
import type { DocRow } from '../types'

// Inverse of the catalog `legacyAlias` map, local to this file. We only need
// this for DocUploader's defaultDocType prop which is still typed DocType.
const LEGACY_BY_CODE: Record<string, DocType> = {
  factura_comercial: 'factura',
  lista_empaque: 'packing_list',
  bl: 'bill_of_lading',
  carta_porte: 'carta_porte',
  certificado_origen_tmec: 'certificado_origen',
  pedimento: 'pedimento',
  rfc_constancia: 'rfc_constancia',
  encargo_conferido: 'encargo_conferido',
  cove: 'cove',
  mve: 'mve',
}

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
  const requiredDocCodes = getRequiredDocCodesByRegimen(regimen)

  function handleMissingDocClick(code: string) {
    // Best-effort back-translation to legacy DocType for DocUploader's
    // defaultDocType prop (still typed to DocType). Unknown codes fall back
    // to undefined — uploader just opens without a preselection.
    const legacy = LEGACY_BY_CODE[code] as DocType | undefined
    setDefaultDocType(legacy)
    if (uploaderRef.current) {
      uploaderRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const button = uploaderRef.current.querySelector<HTMLElement>('[role="button"]')
      if (button) window.setTimeout(() => button.focus(), 250)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. What's already in the expediente — the first thing the user wants to see. */}
      <ExpedienteChecklist
        requiredDocs={requiredDocCodes}
        uploadedDocs={docs}
        onMissingDocClick={handleMissingDocClick}
        grouped
      />

      {/* 2. Request-missing CTA — only when there are actually missing docs. */}
      {missingDocs.length > 0 && (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{
            minHeight: 60,
            padding: '0 20px',
            background: GOLD,
            color: '#0B1220',
            border: 'none',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            letterSpacing: '0.02em',
          }}
        >
          <MailPlus size={14} />
          {`Solicitar ${missingDocs.length} documento${missingDocs.length === 1 ? '' : 's'} faltante${missingDocs.length === 1 ? '' : 's'}`}
        </button>
      )}

      {/* 3. Docs already uploaded. */}
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
            Arrastra una factura, packing list o certificado de origen abajo para iniciar el expediente.
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

      {/* 4. Single upload surface — pinned to the bottom of the tab. */}
      <div ref={uploaderRef} style={{ marginTop: 4 }}>
        <DocUploader traficoId={traficoId} defaultDocType={defaultDocType} />
      </div>

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
