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
      <div className="client-home-header" style={{ marginBottom: 12, textAlign: 'center' }}>
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

      {/* Glass tile grid — fills viewport */}
      <div
        className="client-home-grid"
        style={{
          display: 'grid',
          gap: 12,
          margin: '0 auto',
        }}
      >
        {TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}
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
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 1px rgba(0,229,255,0.12)',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}>
                <div className="tile-icon-wrap" style={{
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
                  <div className="tile-label" style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#E6EDF3',
                    lineHeight: 1.3,
                  }}>
                    {tile.label}
                  </div>
                  <div className="tile-desc" style={{
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

      {/* Responsive grid + hover styles */}
      <style>{`
        /* Desktop: 4 cols x 2 rows, fill viewport */
        .client-home-grid {
          grid-template-columns: repeat(4, 1fr);
          grid-template-rows: 1fr 1fr;
          height: calc(100vh - 140px);
        }
        .client-nav-tile {
          min-height: 60px;
        }
        .client-nav-tile:hover {
          background: rgba(255,255,255,0.06) !important;
          border-color: rgba(0,229,255,0.2) !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 30px rgba(0,229,255,0.18) !important;
          transform: translateY(-2px);
        }
        .client-nav-tile:active {
          transform: translateY(0);
        }

        /* Desktop: scale up content */
        @media (min-width: 769px) {
          .tile-icon-wrap {
            width: 56px !important;
            height: 56px !important;
          }
          .tile-label {
            font-size: 17px !important;
          }
          .tile-desc {
            font-size: 13px !important;
          }
        }

        /* Tablet: 2 cols x 4 rows */
        @media (max-width: 768px) {
          .client-home-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            grid-template-rows: repeat(4, 1fr) !important;
            height: calc(100vh - 120px) !important;
          }
        }

        /* Mobile: compact */
        @media (max-width: 640px) {
          .client-home-header {
            margin-bottom: 8px !important;
          }
          .client-home-header h1 {
            font-size: 18px !important;
          }
          .client-home-header p {
            font-size: 11px !important;
            margin-top: 2px !important;
          }
          .client-home-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            grid-template-rows: repeat(4, 1fr) !important;
            height: calc(100vh - 100px) !important;
            gap: 10px !important;
          }
          .client-nav-tile {
            padding: 14px 12px !important;
          }
          .tile-icon-wrap {
            width: 40px !important;
            height: 40px !important;
            border-radius: 12px !important;
          }
          .tile-label {
            font-size: 13px !important;
          }
          .tile-desc {
            font-size: 10px !important;
          }
        }
      `}</style>
    </div>
  )
}
