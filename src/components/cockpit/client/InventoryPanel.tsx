'use client'

import type { ClientData } from '../shared/fetchCockpitData'

interface Props {
  inventory: ClientData['inventory']
}

export function InventoryPanel({ inventory }: Props) {
  const hasData = inventory.bultos > 0 || inventory.tons > 0

  return (
    <div style={{
      background: '#222222', borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: '3px solid rgba(201,168,76,0.4)',
      padding: 16,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: '#6E7681', marginBottom: 12,
      }}>
        Inventario — bodega
      </div>

      {!hasData ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: '#6E7681', fontSize: 13 }}>
          Sin datos de inventario disponibles
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Stat value={inventory.bultos} label="bultos" />
          <Stat value={`${inventory.tons} ton`} label="peso" />
          <Stat value={`${inventory.oldestDays}d`} label="mas antiguo" />
          {inventory.pendingRelease > 0 && (
            <Stat value={inventory.pendingRelease} label="pendiente liberar" color="#D97706" />
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div>
      <div className="font-mono" style={{
        fontSize: 20, fontWeight: 700, color: color || '#E6EDF3', lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#8B949E', marginTop: 2 }}>{label}</div>
    </div>
  )
}
