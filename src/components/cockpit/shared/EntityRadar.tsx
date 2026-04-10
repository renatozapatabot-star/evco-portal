'use client'

import Link from 'next/link'

interface EntityNode {
  type: 'trafico' | 'entrada' | 'pedimento' | 'expediente' | 'proveedor' | 'cliente' | 'documento'
  id: string
  label: string
  sublabel?: string
  count?: number
  status?: 'green' | 'amber' | 'red' | 'neutral'
  href?: string
}

interface Props {
  /** The central entity being examined */
  center: { type: string; id: string; label: string }
  /** Connected entities radiating from center */
  nodes: EntityNode[]
}

const TYPE_COLORS: Record<string, string> = {
  trafico: '#eab308',
  entrada: '#0D9488',
  pedimento: '#8B5CF6',
  expediente: '#3B82F6',
  proveedor: '#F59E0B',
  cliente: '#16A34A',
  documento: '#8B949E',
}

const TYPE_LABELS: Record<string, string> = {
  trafico: 'Tráfico',
  entrada: 'Entrada',
  pedimento: 'Pedimento',
  expediente: 'Expediente',
  proveedor: 'Proveedor',
  cliente: 'Cliente',
  documento: 'Documento',
}

const STATUS_DOTS: Record<string, string> = {
  green: '#16A34A',
  amber: '#D97706',
  red: '#DC2626',
  neutral: '#6E7681',
}

/**
 * Entity Radar — Palantir-style god view of a single operation.
 * Shows the central entity and all connected entities in a radial layout.
 * Click any node to drill into its detail.
 *
 * This is the "click pedimento → see everything connected" pattern.
 */
export function EntityRadar({ center, nodes }: Props) {
  if (nodes.length === 0) return null

  // Group by type
  const groups = new Map<string, EntityNode[]>()
  for (const n of nodes) {
    const existing = groups.get(n.type) || []
    existing.push(n)
    groups.set(n.type, existing)
  }

  return (
    <div style={{
      background: 'rgba(9,9,11,0.75)', borderRadius: 14, padding: '16px 20px',
      border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: '#eab308', marginBottom: 12,
      }}>
        Radar de entidades
      </div>

      {/* Center entity */}
      <div style={{
        textAlign: 'center', padding: '12px 16px', marginBottom: 16,
        background: 'rgba(201,168,76,0.08)', borderRadius: 10,
        border: '1px solid rgba(201,168,76,0.15)',
      }}>
        <div style={{ fontSize: 10, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          {center.type}
        </div>
        <div className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: '#E6EDF3' }}>
          {center.label}
        </div>
      </div>

      {/* Connected entities by type */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from(groups.entries()).map(([type, items]) => (
          <div key={type}>
            <div style={{
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.05em', color: TYPE_COLORS[type] || '#8B949E',
              marginBottom: 4,
            }}>
              {TYPE_LABELS[type] || type} ({items.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {items.map(node => (
                <NodeChip key={`${node.type}-${node.id}`} node={node} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NodeChip({ node }: { node: EntityNode }) {
  const color = TYPE_COLORS[node.type] || '#8B949E'
  const content = (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 10px', borderRadius: 6,
      background: 'rgba(9,9,11,0.75)',
      border: `1px solid ${color}25`,
      cursor: node.href ? 'pointer' : 'default',
    }}>
      {node.status && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: STATUS_DOTS[node.status] || '#6E7681',
          flexShrink: 0,
        }} />
      )}
      <span className="font-mono" style={{ fontSize: 12, fontWeight: 600, color }}>
        {node.label}
      </span>
      {node.sublabel && (
        <span style={{ fontSize: 10, color: '#6E7681' }}>{node.sublabel}</span>
      )}
      {node.count !== undefined && (
        <span className="font-mono" style={{ fontSize: 10, color: '#6E7681' }}>
          ×{node.count}
        </span>
      )}
    </div>
  )

  if (node.href) {
    return <Link href={node.href} style={{ textDecoration: 'none' }}>{content}</Link>
  }
  return content
}
