'use client'

import { FileText, FolderOpen, ExternalLink, Mail, Check, X, Minus } from 'lucide-react'
import { fmtDateCompact, fmtId, fmtPedimentoShort, fmtUSD } from '@/lib/format-utils'
import Link from 'next/link'

const REQUIRED_DOCS = [
  'factura_comercial', 'packing_list', 'pedimento_detallado',
  'cove', 'acuse_cove', 'doda',
]

const DOC_LABELS: Record<string, string> = {
  factura_comercial: 'Factura Comercial',
  packing_list: 'Lista de Empaque',
  pedimento_detallado: 'Pedimento',
  cove: 'COVE',
  acuse_cove: 'Acuse COVE',
  doda: 'DODA',
  mve: 'MVE',
  otro: 'Otro',
  archivos_validacion: 'Archivos Validación',
  pedimento_simplificado: 'Pedimento Simplificado',
  bol: 'B/L',
  carta_porte: 'Carta Porte',
}

export interface DocFile {
  id: string
  doc_type: string | null
  file_name: string | null
  file_url: string | null
  uploaded_at: string | null
}

interface Props {
  trafico: string
  pedimento: string | null
  docs: DocFile[]
  entrada?: string | null
  proveedor?: string | null
  valor?: number | null
  onClose: () => void
  onViewDoc?: (docs: DocFile[], index: number) => void
}

function getLabel(t: string): string {
  return DOC_LABELS[t] || t.replace(/_/g, ' ')
}

export function DocChecklist({ trafico, pedimento, docs, entrada, proveedor, valor, onClose, onViewDoc }: Props) {
  const presentTypes = new Set(docs.map(d => d.doc_type).filter(Boolean) as string[])

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-card, #E8E5E0)',
      borderRadius: 12, marginTop: 8, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', background: 'var(--bg-main, #FAFAF8)',
        borderBottom: '1px solid var(--border-card, #E8E5E0)',
        flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <FolderOpen size={16} style={{ color: 'var(--gold)' }} />
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {fmtId(trafico)}
          </span>
          {pedimento && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              · {fmtPedimentoShort(pedimento)}
            </span>
          )}
        </div>
        <button onClick={onClose} style={{
          fontSize: 12, color: 'var(--text-muted)', background: 'none',
          border: 'none', cursor: 'pointer', padding: '4px 8px',
        }}>Cerrar ✕</button>
      </div>

      {/* Quick info row */}
      {(proveedor || valor || entrada) && (
        <div style={{
          display: 'flex', gap: 16, padding: '10px 20px', fontSize: 12,
          color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-card, #E8E5E0)',
          flexWrap: 'wrap',
        }}>
          {proveedor && <span>Proveedor: <strong>{proveedor}</strong></span>}
          {valor != null && valor > 0 && <span>Valor: <strong style={{ fontFamily: 'var(--font-mono)' }}>{fmtUSD(valor)}</strong></span>}
          {entrada && <span>Entrada: <Link href={`/entradas/${entrada}`} style={{ color: 'var(--gold-dark, #8B6914)', fontWeight: 600, textDecoration: 'none' }} onClick={e => e.stopPropagation()}>{entrada}</Link></span>}
        </div>
      )}

      {/* Document checklist */}
      <div style={{ padding: 0 }}>
        {REQUIRED_DOCS.map(reqType => {
          const found = docs.find(d => d.doc_type === reqType)
          const isPresent = presentTypes.has(reqType)

          return (
            <div key={reqType} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
              borderBottom: '1px solid var(--border-card, #E8E5E0)',
            }}>
              {isPresent ? (
                <Check size={14} style={{ color: 'var(--success-500)', flexShrink: 0 }} />
              ) : (
                <X size={14} style={{ color: 'var(--danger-500)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: isPresent ? 'var(--text-primary)' : 'var(--text-muted)',
                }}>
                  {getLabel(reqType)}
                </div>
                {found?.uploaded_at && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {fmtDateCompact(found.uploaded_at)}
                  </div>
                )}
              </div>
              {found?.file_url && onViewDoc && (
                <button onClick={e => { e.stopPropagation(); onViewDoc(docs.filter(d => d.file_url), docs.filter(d => d.file_url).indexOf(found)) }}
                  style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--gold)',
                    background: 'rgba(196,150,60,0.06)', border: '1px solid rgba(196,150,60,0.15)',
                    borderRadius: 6, cursor: 'pointer', padding: '6px 12px', flexShrink: 0, minHeight: 32,
                  }}>
                  Ver
                </button>
              )}
            </div>
          )
        })}

        {/* Extra docs not in required list */}
        {docs.filter(d => d.doc_type && !REQUIRED_DOCS.includes(d.doc_type)).map(doc => (
          <div key={doc.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
            borderBottom: '1px solid var(--border-card, #E8E5E0)',
          }}>
            <Minus size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                {getLabel(doc.doc_type || 'otro')}
              </div>
            </div>
            {doc.file_url && onViewDoc && (
              <button onClick={e => { e.stopPropagation(); onViewDoc(docs.filter(d => d.file_url), docs.filter(d => d.file_url).indexOf(doc)) }}
                style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--gold)',
                  background: 'rgba(196,150,60,0.06)', border: '1px solid rgba(196,150,60,0.15)',
                  borderRadius: 6, cursor: 'pointer', padding: '6px 12px', flexShrink: 0, minHeight: 32,
                }}>
                Ver
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{
        padding: '10px 20px', borderTop: '1px solid var(--border-card, #E8E5E0)',
        display: 'flex', gap: 8, flexWrap: 'wrap',
      }}>
        <Link href={`/traficos/${encodeURIComponent(trafico)}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
            color: 'var(--gold-dark, #8B6914)', background: 'none',
            border: '1px solid var(--border-card, #E8E5E0)', borderRadius: 8,
            padding: '8px 14px', textDecoration: 'none', minHeight: 60,
          }} onClick={e => e.stopPropagation()}>
          <ExternalLink size={13} /> Ver tráfico
        </Link>
        <button onClick={e => { e.stopPropagation(); window.open(`mailto:ai@renatozapata.com?subject=Solicitud de documento — Tráfico ${trafico}`, '_blank') }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
            color: 'var(--text-muted)', background: 'none',
            border: '1px solid var(--border-card, #E8E5E0)', borderRadius: 8,
            padding: '8px 14px', cursor: 'pointer', minHeight: 60,
          }}>
          <Mail size={13} /> Solicitar documento
        </button>
      </div>
    </div>
  )
}
