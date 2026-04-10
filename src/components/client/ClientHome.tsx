'use client'

import Link from 'next/link'
import {
  Package, Truck, FileText, ClipboardList,
  FileSpreadsheet, FolderOpen, BarChart3, TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavTile {
  href: string
  label: string
  icon: LucideIcon
  description: string
}

const TILES: NavTile[] = [
  { href: '/entradas',    label: 'Entradas',             icon: Package,         description: 'Mercancía recibida en bodega' },
  { href: '/traficos',    label: 'Tráficos',             icon: Truck,           description: 'Operaciones de importación' },
  { href: '/pedimentos',  label: 'Pedimentos',           icon: FileText,        description: 'Declaraciones aduanales' },
  { href: '/catalogo',    label: 'Catálogo de Partes',   icon: ClipboardList,   description: 'Productos y fracciones' },
  { href: '/anexo24',     label: 'Anexo 24',             icon: FileSpreadsheet, description: 'Control de inventarios' },
  { href: '/expedientes', label: 'Expedientes Digitales', icon: FolderOpen,     description: 'Documentos por operación' },
  { href: '/reportes',    label: 'Reportes',             icon: BarChart3,       description: 'Análisis y estadísticas' },
  { href: '/kpis',        label: "KPI's",                icon: TrendingUp,      description: 'Indicadores clave' },
]

export function ClientHome({ companyName }: { companyName?: string }) {
  return (
    <div style={{ padding: '8px 0' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h1 style={{
          fontSize: 22,
          fontWeight: 800,
          color: '#E6EDF3',
          margin: 0,
          letterSpacing: '-0.02em',
        }}>
          {companyName || 'Portal'}
        </h1>
        <p style={{
          fontSize: 13,
          color: '#64748b',
          marginTop: 6,
          fontWeight: 500,
        }}>
          Seleccione una sección
        </p>
      </div>

      {/* Glass tile grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
        maxWidth: 1200,
        margin: '0 auto',
      }}>
        {TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div
              className="client-nav-tile"
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20,
                padding: '28px 24px',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                minHeight: 120,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 1px rgba(0,229,255,0.12)',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: 'rgba(0,229,255,0.08)',
                  border: '1px solid rgba(0,229,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <tile.icon size={22} color="#00E5FF" strokeWidth={1.8} />
                </div>
                <div>
                  <div style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#E6EDF3',
                    lineHeight: 1.3,
                  }}>
                    {tile.label}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: '#64748b',
                    marginTop: 4,
                    lineHeight: 1.4,
                  }}>
                    {tile.description}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* CSS for hover effect */}
      <style>{`
        .client-nav-tile:hover {
          background: rgba(255,255,255,0.06) !important;
          border-color: rgba(0,229,255,0.2) !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 30px rgba(0,229,255,0.18) !important;
          transform: translateY(-2px);
        }
        .client-nav-tile:active {
          transform: translateY(0);
        }
        @media (max-width: 640px) {
          .client-nav-tile {
            min-height: 80px !important;
            padding: 20px 18px !important;
          }
        }
      `}</style>
    </div>
  )
}
