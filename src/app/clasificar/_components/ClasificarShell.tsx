'use client'

import { useState } from 'react'
import { PendientesTab } from './PendientesTab'
import { ClasificarNuevoTab } from './ClasificarNuevoTab'

type Tab = 'pendientes' | 'nuevo'

interface ClasificarShellProps {
  canInsert: boolean
  initialTab?: Tab
}

const TAB_BTN_BASE: React.CSSProperties = {
  flex: 1,
  minHeight: 60,
  padding: '0 20px',
  fontSize: 14,
  fontWeight: 600,
  background: 'transparent',
  color: 'rgba(255,255,255,0.6)',
  border: 'none',
  borderRadius: 12,
  cursor: 'pointer',
  transition: 'background 150ms, color 150ms',
}

export function ClasificarShell({ canInsert, initialTab = 'pendientes' }: ClasificarShellProps) {
  const [tab, setTab] = useState<Tab>(initialTab)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <h1
        style={{
          margin: '0 0 16px',
          fontSize: 24,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.92)',
        }}
      >
        Clasificar
      </h1>

      <div
        role="tablist"
        aria-label="Modo de clasificación"
        style={{
          display: 'flex',
          gap: 4,
          padding: 4,
          marginBottom: 24,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
        }}
      >
        <button
          role="tab"
          aria-selected={tab === 'pendientes'}
          onClick={() => setTab('pendientes')}
          style={{
            ...TAB_BTN_BASE,
            background: tab === 'pendientes' ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: tab === 'pendientes' ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.6)',
          }}
        >
          Pendientes
        </button>
        <button
          role="tab"
          aria-selected={tab === 'nuevo'}
          onClick={() => setTab('nuevo')}
          style={{
            ...TAB_BTN_BASE,
            background: tab === 'nuevo' ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: tab === 'nuevo' ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.6)',
          }}
        >
          Clasificar nuevo
        </button>
      </div>

      <div role="tabpanel">
        {tab === 'pendientes' ? <PendientesTab /> : <ClasificarNuevoTab canInsert={canInsert} />}
      </div>
    </div>
  )
}
