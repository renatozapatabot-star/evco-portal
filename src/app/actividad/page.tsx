'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getCompanyIdCookie } from '@/lib/client-config'
import { useIsMobile } from '@/hooks/use-mobile'
import { fmtDateTime } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const DOC_DISPLAY_NAMES: Record<string, string> = {
  factura: 'Factura Comercial',
  packing_list: 'Lista de Empaque',
  pedimento: 'Pedimento',
  cove: 'COVE',
  doda: 'DODA',
  carta_porte: 'Carta Porte',
  certificado_origen: 'Certificado de Origen',
  conocimiento_embarque: 'Conocimiento de Embarque',
  acuse_cove: 'Acuse de COVE',
  guia_embarque: 'Guía de Embarque',
  nom: 'Certificado NOM',
  proforma: 'Factura Proforma',
  orden_compra: 'Orden de Compra',
  permiso: 'Permiso',
  coa: 'Certificado de Análisis',
}

function displayDocType(raw: string | null): string {
  if (!raw) return 'Documento'
  const key = raw.toLowerCase().replace(/\s+/g, '_')
  return DOC_DISPLAY_NAMES[key] || raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

interface FeedItem {
  id: string
  type: string
  icon: string
  text: string
  href: string
  timestamp: string
  isNew: boolean
}

export default function ActividadPage() {
  const isMobile = useIsMobile()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lastSeen, setLastSeen] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cruz-feed-last-seen') || ''
    }
    return ''
  })

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    if (!companyId) return

    Promise.all([
      // Recent embarque status changes
      supabase.from('traficos')
        .select('trafico, estatus, fecha_cruce, fecha_llegada, importe_total, updated_at')
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(20),
      // Recent documents
      supabase.from('expediente_documentos')
        .select('pedimento_id, doc_type, uploaded_at')
        .eq('company_id', companyId)
        .order('uploaded_at', { ascending: false })
        .limit(10),
      // Recent solicitudes
      supabase.from('documento_solicitudes')
        .select('trafico_id, doc_type, status, solicitado_at, recibido_at')
        .eq('company_id', companyId)
        .order('solicitado_at', { ascending: false })
        .limit(10),
    ]).then(([trafRes, docRes, solRes]) => {
      const feed: FeedItem[] = []

      // Crossings
      for (const t of (trafRes.data || [])) {
        const isCruzado = (t.estatus || '').toLowerCase().includes('cruz')
        if (isCruzado && t.fecha_cruce) {
          feed.push({
            id: `cross-${t.trafico}`,
            type: 'crossing',
            icon: '✅',
            text: `Embarque ${t.trafico} cruzó`,
            href: `/embarques/${encodeURIComponent(t.trafico)}`,
            timestamp: t.fecha_cruce,
            isNew: t.fecha_cruce > (lastSeen || ''),
          })
        } else if (t.fecha_llegada && t.updated_at) {
          feed.push({
            id: `status-${t.trafico}`,
            type: 'status',
            icon: '📦',
            text: `${t.trafico}: ${t.estatus || 'En proceso'}`,
            href: `/embarques/${encodeURIComponent(t.trafico)}`,
            timestamp: t.updated_at,
            isNew: t.updated_at > (lastSeen || ''),
          })
        }
      }

      // Documents received
      for (const d of (docRes.data || [])) {
        if (d.uploaded_at) {
          feed.push({
            id: `doc-${d.pedimento_id}-${d.doc_type}`,
            type: 'document',
            icon: '📄',
            text: `${displayDocType(d.doc_type)} recibido para ${d.pedimento_id}`,
            href: `/expedientes`,
            timestamp: d.uploaded_at,
            isNew: d.uploaded_at > (lastSeen || ''),
          })
        }
      }

      // Solicitations
      for (const s of (solRes.data || [])) {
        if (s.status === 'solicitado' && s.solicitado_at) {
          feed.push({
            id: `sol-${s.trafico_id}-${s.doc_type}`,
            type: 'solicitation',
            icon: '📩',
            text: `RZ solicitó ${displayDocType(s.doc_type)} para ${s.trafico_id}`,
            href: `/embarques/${encodeURIComponent(s.trafico_id)}`,
            timestamp: s.solicitado_at,
            isNew: s.solicitado_at > (lastSeen || ''),
          })
        }
        if (s.status === 'recibido' && s.recibido_at) {
          feed.push({
            id: `recv-${s.trafico_id}-${s.doc_type}`,
            type: 'received',
            icon: '✅',
            text: `${displayDocType(s.doc_type)} recibido para ${s.trafico_id}`,
            href: `/expedientes`,
            timestamp: s.recibido_at,
            isNew: s.recibido_at > (lastSeen || ''),
          })
        }
      }

      // Sort by timestamp, newest first
      feed.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

      // Mark as seen
      if (feed.length > 0) {
        localStorage.setItem('cruz-feed-last-seen', feed[0].timestamp)
      }

      setItems(feed.slice(0, 30))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [lastSeen])

  const newCount = items.filter(i => i.isNew).length

  return (
    <div style={{ padding: isMobile ? '16px 12px' : '24px 16px', maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--aguila-fs-title)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Actividad</h1>
      <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)', margin: '0 0 24px' }}>
        {newCount > 0 ? `${newCount} nuevo${newCount !== 1 ? 's' : ''}` : 'Todo al día'}
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 56, borderRadius: 8 }} />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="📋" title="Todo tranquilo por aquí" description="Sin pendientes. Cuando haya movimiento, lo verá aquí. 🦀" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map(item => (
            <Link
              key={item.id}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 8, textDecoration: 'none',
                background: item.isNew ? 'rgba(196,150,60,0.04)' : 'transparent',
                transition: 'background 100ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F5F4F0' }}
              onMouseLeave={e => { e.currentTarget.style.background = item.isNew ? 'rgba(196,150,60,0.04)' : 'transparent' }}
            >
              {/* New indicator */}
              <div style={{ width: 6, flexShrink: 0 }}>
                {item.isNew && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)' }} />}
              </div>
              {/* Icon */}
              <span style={{ fontSize: 'var(--aguila-fs-kpi-small)', flexShrink: 0 }}>{item.icon}</span>
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.text}
                </div>
              </div>
              {/* Time */}
              <span style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                {fmtDateTime(item.timestamp)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
