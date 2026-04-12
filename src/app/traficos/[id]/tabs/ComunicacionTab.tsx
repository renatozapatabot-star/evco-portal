'use client'

import { useState } from 'react'
import { Mail, MailPlus } from 'lucide-react'
import {
  BG_CARD,
  BORDER,
  GLASS_BLUR,
  GLASS_SHADOW,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { SolicitarDocsModal } from '@/components/trafico/SolicitarDocsModal'
import type { DocType } from '@/lib/doc-requirements'

interface ComunicacionTabProps {
  traficoId: string
  cliente: string
  proveedor: string | null
  operatorName: string
  missingDocs: DocType[]
}

/**
 * Placeholder surface. The supplier/client communication channel is
 * still wired through the solicitud flow; when email threads land,
 * this tab hosts the full history.
 */
export function ComunicacionTab({
  traficoId,
  cliente,
  proveedor,
  operatorName,
  missingDocs,
}: ComunicacionTabProps) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          background: BG_CARD,
          backdropFilter: `blur(${GLASS_BLUR})`,
          WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          boxShadow: GLASS_SHADOW,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          textAlign: 'center',
        }}
      >
        <Mail size={24} style={{ color: TEXT_MUTED }} />
        <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>
          Historial de comunicación con proveedores y cliente · Próximamente
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{
            minHeight: 60,
            padding: '0 20px',
            marginTop: 8,
            background: 'rgba(0,229,255,0.12)',
            color: TEXT_PRIMARY,
            border: `1px solid rgba(0,229,255,0.4)`,
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <MailPlus size={14} /> Enviar solicitud al proveedor
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Fecha', 'Destinatario', 'Asunto', 'Estado'].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 700,
                    color: TEXT_MUTED,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '10px 12px',
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={4}
                style={{
                  padding: '20px 12px',
                  color: TEXT_MUTED,
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                Sin comunicaciones registradas
              </td>
            </tr>
          </tbody>
        </table>
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
