'use client'

import { useState } from 'react'
import { DocumentosView } from '@/components/views/documentos-view'
import { ExpedientesView } from '@/components/views/expedientes-view'

type DocTab = 'legales' | 'expedientes'

export default function DocumentosPage() {
  const [activeTab, setActiveTab] = useState<DocTab>('legales')

  return (
    <div>
      {/* Top-level tab bar */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid #E8E5E0',
        padding: '0 32px',
        background: '#FAFAF8',
      }}>
        {([
          { key: 'legales' as DocTab, label: 'Documentos Legales' },
          { key: 'expedientes' as DocTab, label: 'Expedientes' },
        ]).map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 20px',
                fontSize: 14,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#B8953F' : '#6B6B6B',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid #B8953F' : '3px solid transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 150ms',
                minHeight: 48,
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'legales' ? <DocumentosView /> : <ExpedientesView />}
    </div>
  )
}
