'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { OperatorData } from '../shared/fetchCockpitData'
import { IfThenCard } from '../shared/IfThenCard'

interface Props {
  blocked: OperatorData['blocked']
  operatorName: string
}

export function DocumentChaser({ blocked, operatorName }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const withMissingDocs = blocked.filter(b => b.missingDocs.length > 0)

  if (withMissingDocs.length === 0) return null

  const copyMessage = async (item: OperatorData['blocked'][0]) => {
    const docList = item.missingDocs.map(d => `  • ${d}`).join('\n')
    const message = `Hola,

Estamos preparando el embarque ${item.trafico} y aún nos faltan los siguientes documentos:

${docList}

Por favor envíalos lo antes posible para no retrasar el cruce.

Gracias,
${operatorName.split(' ')[0]}
Renato Zapata & Company
Patente 3596 · Aduana 240`

    try {
      await navigator.clipboard.writeText(message)
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(null), 3000)
    } catch {
      // Fallback for browsers without clipboard API
      setCopiedId(null)
    }
  }

  return (
    <IfThenCard
      id="operator-doc-chaser"
      state={withMissingDocs.length > 2 ? 'urgent' : 'active'}
      title="Documentos faltantes"
      activeCondition={`${withMissingDocs.length} embarque${withMissingDocs.length !== 1 ? 's' : ''} con documentos pendientes`}
      activeAction="Enviar recordatorio"
      urgentCondition={withMissingDocs.length > 2 ? `${withMissingDocs.length} embarques esperando documentos` : undefined}
      urgentAction={withMissingDocs.length > 2 ? 'Resolver ahora' : undefined}
      quietContent={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {withMissingDocs.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', background: 'rgba(255,255,255,0.02)',
              borderRadius: 8, border: '1px solid rgba(255,255,255,0.045)', gap: 10,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/embarques/${encodeURIComponent(item.trafico)}`} style={{
                  textDecoration: 'none',
                }}>
                  <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: '#E8EAED' }}>
                    {item.trafico}
                  </span>
                </Link>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: '#D97706', marginTop: 2 }}>
                  Falta: {item.missingDocs.slice(0, 3).join(', ')}
                  {item.missingDocs.length > 3 && ` +${item.missingDocs.length - 3} más`}
                </div>
              </div>
              <button
                onClick={() => copyMessage(item)}
                style={{
                  background: copiedId === item.id ? 'rgba(22,163,74,0.15)' : 'rgba(192,197,206,0.15)',
                  color: copiedId === item.id ? '#16A34A' : '#E8EAED',
                  border: 'none', borderRadius: 8, padding: '8px 14px',
                  fontSize: 'var(--aguila-fs-compact)', fontWeight: 600, cursor: 'pointer',
                  whiteSpace: 'nowrap', minHeight: 36,
                  display: 'flex', alignItems: 'center',
                }}
              >
                {copiedId === item.id ? '✓ Copiado' : 'Copiar mensaje'}
              </button>
            </div>
          ))}
        </div>
      }
    />
  )
}
