'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CLIENT_CLAVE, CLIENT_NAME } from '@/lib/client-config'
import { GOLD_GRADIENT } from '@/lib/design-system'

interface WelcomeData {
  companyName: string
  activeTraficos: number
  valorYTD: string
  complianceScore: number
  tmecOpportunity: string | null
}

export function WelcomeOverlay() {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [data, setData] = useState<WelcomeData | null>(null)

  useEffect(() => {
    // Check if first visit
    const visited = localStorage.getItem('cruz_welcome_dismissed')
    if (visited) return

    // Check if just signed up (session marker)
    const firstLogin = !localStorage.getItem('cruz_first_visit')
    if (!firstLogin) return

    // Load summary data
    Promise.all([
      fetch(`/api/data?table=traficos&trafico_prefix=${CLIENT_CLAVE}-&limit=1000&order_by=fecha_llegada&order_dir=desc`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/data?table=client_benchmarks&limit=10').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/data?table=compliance_predictions&limit=50').then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([trafRes, benchRes, compRes]) => {
      const traficos = trafRes.data || []
      const active = traficos.filter((t: any) => !(t.estatus || '').toLowerCase().includes('cruz'))
      const totalValor = traficos.reduce((s: number, t: any) => s + (Number(t.importe_total) || 0), 0)

      const benchRow = (benchRes.data || []).find((b: any) => b.metrics)
      const tmecRate = benchRow?.metrics?.tmec_utilization_rate?.value

      const comp = (compRes.data || []).filter((p: any) => !p.resolved)
      const critical = comp.filter((p: any) => p.severity === 'critical').length
      const compScore = Math.max(0, 100 - (critical * 15))

      const fmtVal = totalValor >= 1_000_000 ? `$${(totalValor / 1e6).toFixed(1)}M USD` : `$${Math.round(totalValor / 1e3)}K USD`

      setData({
        companyName: CLIENT_NAME,
        activeTraficos: active.length,
        valorYTD: fmtVal,
        complianceScore: compScore,
        tmecOpportunity: tmecRate != null && Number(tmecRate) < 85 ? `Potencial T-MEC: ${(85 - Number(tmecRate)).toFixed(0)}% de mejora posible` : null,
      })
      setShow(true)
    })
  }, [])

  const dismiss = () => {
    localStorage.setItem('cruz_welcome_dismissed', 'true')
    localStorage.setItem('cruz_first_visit', new Date().toISOString())
    setShow(false)
  }

  const askCruz = (question: string) => {
    localStorage.setItem('cruz_welcome_dismissed', 'true')
    localStorage.setItem('cruz_first_visit', new Date().toISOString())
    localStorage.setItem('cruz_pending_question', question)
    setShow(false)
    router.push('/cruz')
  }

  if (!show || !data) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'var(--bg-primary, #0a0a0a)', border: '1px solid var(--border-light)',
        borderRadius: 16, padding: 32, maxWidth: 520, width: '100%',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 16,
            background: GOLD_GRADIENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 4px 12px rgba(201,168,76,0.3)',
          }}>
            <span style={{
              fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 700,
              color: '#1A1710',
            }}>Z</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Bienvenido a CRUZ
          </h2>
          <div style={{ fontSize: 14, color: 'var(--gold-600)', fontWeight: 600, marginTop: 4 }}>
            {data.companyName}
          </div>
        </div>

        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Encontré esto sobre sus operaciones:
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: 'var(--n-50)', border: '1px solid var(--border-light)',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tráficos activos</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-data)' }}>{data.activeTraficos}</span>
          </div>
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: 'var(--n-50)', border: '1px solid var(--border-light)',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Valor importado YTD</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-data)' }}>{data.valorYTD}</span>
          </div>
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: 'var(--n-50)', border: '1px solid var(--border-light)',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Compliance score</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-data)', color: data.complianceScore >= 80 ? 'var(--success)' : 'var(--warning)' }}>{data.complianceScore}/100</span>
          </div>
          {data.tmecOpportunity && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, color: 'var(--success)' }}>{data.tmecOpportunity}</span>
            </div>
          )}
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Pregúntale a CRUZ para empezar:
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {[
            '¿Cuáles son mis tráficos activos?',
            '¿Cuál es mi score de cumplimiento?',
            '¿Dónde puedo ahorrar en aranceles?',
          ].map(q => (
            <button key={q} onClick={() => askCruz(q)} style={{
              padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-light)',
              background: 'transparent', cursor: 'pointer', textAlign: 'left',
              color: 'var(--gold-600)', fontSize: 13, fontWeight: 500,
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--n-50)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {q}
            </button>
          ))}
        </div>

        <button onClick={dismiss} style={{
          width: '100%', padding: '12px 0', borderRadius: 8,
          background: 'var(--gold-600)', color: '#000', border: 'none',
          cursor: 'pointer', fontWeight: 700, fontSize: 14,
        }}>
          Ir al dashboard
        </button>
      </div>
    </div>
  )
}
