'use client'

import { useState } from 'react'
import { getErrorMessage } from '@/lib/errors'
import { useIsMobile } from '@/hooks/use-mobile'
import { PORTAL_URL } from '@/lib/client-config'

const ENDPOINTS = [
  { method: 'GET', path: '/api/v1/intelligence?type=risk&id={trafico_id}', desc: 'Risk score for a embarque', example: '?type=risk&id={trafico_id}' },
  { method: 'GET', path: '/api/v1/intelligence?type=crossing&id={trafico_id}', desc: 'Crossing time prediction', example: '?type=crossing&id={trafico_id}' },
  { method: 'GET', path: '/api/v1/intelligence?type=supplier&id={name}', desc: 'Supplier intelligence profile', example: '?type=supplier&id=COVESTRO' },
  { method: 'GET', path: '/api/v1/intelligence?type=benchmark', desc: 'Client benchmarks vs industry', example: '?type=benchmark' },
  { method: 'GET', path: '/api/v1/intelligence?type=compliance', desc: 'Compliance score and predictions', example: '?type=compliance' },
  { method: 'GET', path: '/api/v1/intelligence?type=regulatory', desc: 'Recent regulatory alerts', example: '?type=regulatory' },
  { method: 'GET', path: '/api/v1/intelligence?type=oca&id={query}', desc: 'OCA classification lookup', example: '?type=oca&id=policarbonato' },
  { method: 'GET', path: '/api/v1/intelligence', desc: 'Full intelligence summary', example: '' },
  { method: 'GET', path: '/api/data?table={name}', desc: 'Raw data query (28 tables)', example: '?table=traficos&limit=10' },
  { method: 'POST', path: '/api/webhooks', desc: 'Subscribe to events', example: '{"action":"subscribe","url":"...","events":["shipment.crossed"]}' },
  { method: 'POST', path: '/api/supplier-comms', desc: 'Queue supplier communication', example: '{"supplier":"COVESTRO","trafico":"{trafico_id}"}' },
  { method: 'POST', path: '/api/chat', desc: 'PORTAL chat query', example: '{"messages":[{"role":"user","content":"..."}]}' },
]

export default function ApiDocsPage() {
  const isMobile = useIsMobile()
  const [tryResult, setTryResult] = useState<string | null>(null)
  const [trying, setTrying] = useState<string | null>(null)

  async function tryEndpoint(ep: typeof ENDPOINTS[0]) {
    setTrying(ep.path)
    setTryResult(null)
    try {
      const url = ep.method === 'GET' ? `/api/v1/intelligence${ep.example}` : ep.path
      const res = await fetch(url)
      const data = await res.json()
      setTryResult(JSON.stringify(data, null, 2))
    } catch (e: unknown) {
      setTryResult(`Error: ${getErrorMessage(e)}`)
    }
    setTrying(null)
  }

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 className="pg-title">PORTAL API v1</h1>
        <p className="pg-meta">Intelligence API · Renato Zapata & Company</p>
      </div>

      <div className="card" style={{ marginBottom: 24, padding: '16px 20px', background: 'var(--amber-100, #FFF8EB)' }}>
        <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--amber-800, #633806)' }}>
          <strong>Base URL:</strong> <code style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 4 }}>https://{PORTAL_URL}</code>
        </div>
      </div>

      {ENDPOINTS.map((ep, i) => (
        <div key={i} className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '12px 14px' : '14px 20px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <span style={{
              fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)',
              background: ep.method === 'GET' ? 'rgba(22,163,74,0.1)' : 'rgba(37,99,235,0.1)',
              color: ep.method === 'GET' ? 'var(--success)' : 'var(--info)',
            }}>{ep.method}</span>
            <code style={{ fontSize: isMobile ? 11 : 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', flex: 1, overflowWrap: 'break-word', wordBreak: 'break-all' }}>{ep.path}</code>
            {ep.method === 'GET' && (
              <button onClick={() => tryEndpoint(ep)} disabled={trying === ep.path}
                style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border-primary)', background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--amber-700)' }}>
                {trying === ep.path ? '...' : 'Try it'}
              </button>
            )}
          </div>
          <div style={{ padding: '0 20px 14px', fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)' }}>{ep.desc}</div>
        </div>
      ))}

      {tryResult && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head"><span className="card-title">Response</span></div>
          <pre style={{ padding: 20, fontSize: 'var(--aguila-fs-compact)', overflow: 'auto', maxHeight: 400, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', background: 'var(--bg-elevated)', margin: 0 }}>
            {tryResult}
          </pre>
        </div>
      )}
    </div>
  )
}
