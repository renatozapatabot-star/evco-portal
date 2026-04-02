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
      <div className="tab-bar" style={{ padding: '0 32px', background: 'var(--bg-main)' }}>
        {([
          { key: 'legales' as DocTab, label: 'Documentos Legales' },
          { key: 'expedientes' as DocTab, label: 'Expedientes' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'legales' ? <DocumentosView /> : <ExpedientesView />}
    </div>
  )
}
