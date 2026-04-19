'use client'

import type { ClientData } from '../shared/fetchCockpitData'
import { IfThenCard } from '../shared/IfThenCard'
import { computeInventoryState } from '../shared/cardStates'

interface Props {
  inventory: ClientData['inventory']
}

export function InventoryPanel({ inventory }: Props) {
  const hasData = inventory.bultos > 0 || inventory.tons > 0
  const cardState = computeInventoryState(inventory.bultos, inventory.oldestDays)

  return (
    <IfThenCard
      id="client-inventory"
      state={cardState.state}
      title="Inventario — bodega"
      activeCondition={cardState.activeCondition}
      activeAction={cardState.activeAction}
      urgentCondition={cardState.urgentCondition}
      urgentAction={cardState.urgentAction}
      actionHref="/bodega"
      quietContent={
        !hasData ? (
          <div style={{ padding: '12px 0', textAlign: 'center', color: '#6E7681', fontSize: 'var(--aguila-fs-body)' }}>
            Sin datos de inventario disponibles
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Stat value={inventory.bultos} label={inventory.bultos === 1 ? 'bulto' : 'bultos'} />
            <Stat value={`${inventory.tons} ton`} label="peso" />
            <Stat value={`${inventory.oldestDays}d`} label="más antiguo" />
            {inventory.pendingRelease > 0 && (
              <Stat value={inventory.pendingRelease} label="pendiente liberar" color="var(--portal-status-amber-fg)" />
            )}
          </div>
        )
      }
    />
  )
}

function Stat({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div>
      <div className="font-mono" style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 700, color: color || 'var(--portal-fg-1)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--aguila-fs-meta)', color: '#8B949E', marginTop: 2 }}>{label}</div>
    </div>
  )
}
