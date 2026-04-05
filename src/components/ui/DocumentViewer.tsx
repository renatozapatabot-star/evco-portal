'use client'

import { useState } from 'react'
import { X, Download, ChevronLeft, ChevronRight, FileText, ExternalLink } from 'lucide-react'

interface DocItem {
  doc_type: string | null
  file_url?: string | null
  nombre?: string | null
  file_name?: string | null
  uploaded_at?: string | null
  source?: string | null
}

interface DocumentViewerProps {
  documents: DocItem[]
  initialIndex: number
  onClose: () => void
  traficoId?: string
}

const DOC_LABELS: Record<string, string> = {
  factura_comercial: 'Factura Comercial',
  packing_list: 'Packing List',
  bill_of_lading: 'Bill of Lading',
  conocimiento_embarque: 'Conocimiento de Embarque',
  cove: 'COVE',
  acuse_cove: 'Acuse COVE',
  mve: 'MVE Folio',
  pedimento: 'Pedimento',
  pedimento_detallado: 'Pedimento Detallado',
  carta_porte: 'Carta Porte',
  certificado_origen: 'Certificado de Origen',
  doda_previo: 'DODA Previo',
  cuenta_gastos: 'Cuenta de Gastos',
  nom: 'Certificado NOM',
  coa: 'Certificate of Analysis',
  orden_compra: 'Orden de Compra',
  guia_embarque: 'Guía de Embarque',
  entrada_bodega: 'Entrada de Bodega',
  proforma: 'Proforma',
  permiso: 'Permiso',
}

function getDocLabel(type: string): string {
  return DOC_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function isViewableUrl(url: string | null | undefined): boolean {
  if (!url) return false
  if (url.startsWith('globalpc://')) return false
  return url.startsWith('http')
}

function isXml(url: string | null | undefined): boolean {
  return !!url && url.endsWith('.xml')
}

export function DocumentViewer({ documents, initialIndex, onClose, traficoId }: DocumentViewerProps) {
  const [index, setIndex] = useState(initialIndex)
  const doc = documents[index]
  if (!doc) return null

  const label = getDocLabel(doc.doc_type || '')
  const name = doc.nombre || doc.file_name || label
  const viewable = isViewableUrl(doc.file_url)
  const xml = isXml(doc.file_url)

  const prev = () => setIndex(i => Math.max(0, i - 1))
  const next = () => setIndex(i => Math.min(documents.length - 1, i + 1))

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 900,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #E8E5E0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>{label}</div>
            <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 2 }}>
              {name}
              {traficoId && <> · <span style={{ fontFamily: 'var(--font-mono)' }}>{traficoId}</span></>}
              {doc.source && <> · {doc.source}</>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {viewable && (
              <a
                href={doc.file_url!}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px', borderRadius: 6,
                  background: '#C4963C', color: '#FFFFFF',
                  fontSize: 12, fontWeight: 600, textDecoration: 'none',
                }}
              >
                <Download size={14} /> Descargar
              </a>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 8, borderRadius: 6, color: '#6B6B6B',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body — document preview or fallback */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 300 }}>
          {viewable && !xml ? (
            <iframe
              src={doc.file_url!}
              style={{ width: '100%', height: 500, border: 'none' }}
              title={label}
            />
          ) : viewable && xml ? (
            <div style={{ padding: 24 }}>
              <div style={{ padding: 20, background: '#FAFAF8', borderRadius: 8, border: '1px solid #E8E5E0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <FileText size={20} style={{ color: '#C4963C' }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Documento XML</span>
                </div>
                <a
                  href={doc.file_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, color: '#C4963C', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  Abrir en nueva pestaña <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <FileText size={48} style={{ color: '#9B9B9B', margin: '0 auto 16px' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>
                Documento no disponible para vista previa
              </div>
              <div style={{ fontSize: 13, color: '#6B6B6B' }}>
                {doc.file_url?.startsWith('globalpc://')
                  ? 'Este documento está almacenado en GlobalPC y no tiene vista previa directa'
                  : 'El archivo no está disponible en este momento'}
              </div>
            </div>
          )}
        </div>

        {/* Footer — navigation */}
        {documents.length > 1 && (
          <div style={{
            padding: '12px 20px', borderTop: '1px solid #E8E5E0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <button
              onClick={prev}
              disabled={index === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: index === 0 ? '#F5F4F0' : '#FFFFFF',
                border: '1px solid #E8E5E0', cursor: index === 0 ? 'default' : 'pointer',
                color: index === 0 ? '#9B9B9B' : '#1A1A1A',
                minHeight: 40,
              }}
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <span style={{ fontSize: 12, color: '#6B6B6B', fontFamily: 'var(--font-mono)' }}>
              {index + 1} / {documents.length}
            </span>
            <button
              onClick={next}
              disabled={index === documents.length - 1}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: index === documents.length - 1 ? '#F5F4F0' : '#FFFFFF',
                border: '1px solid #E8E5E0', cursor: index === documents.length - 1 ? 'default' : 'pointer',
                color: index === documents.length - 1 ? '#9B9B9B' : '#1A1A1A',
                minHeight: 40,
              }}
            >
              Siguiente <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
