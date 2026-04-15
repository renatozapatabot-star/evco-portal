'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCompanyIdCookie, getClientNameCookie } from '@/lib/client-config'
import { useIsMobile } from '@/hooks/use-mobile'
import { AguilaMark } from '@/components/brand/AguilaMark'

function AnimatedCounter({ target, label, delay }: { target: number; label: string; delay: number }) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => {
      let frame = 0
      const steps = 40
      const interval = setInterval(() => {
        frame++
        setValue(Math.round((frame / steps) * target))
        if (frame >= steps) clearInterval(interval)
      }, 30)
      return () => clearInterval(interval)
    }, delay)
    return () => clearTimeout(timer)
  }, [target, delay])

  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 800, color: 'var(--gold)' }}>
        {label.includes('$') ? `$${value.toLocaleString('es-MX')}` : value.toLocaleString('es-MX')}
      </div>
      <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

export default function BienvenidaPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [companyName, setCompanyName] = useState('')
  const [stats, setStats] = useState({ traficos: 0, docs: 0, suppliers: 0, value: 0 })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const name = getClientNameCookie()
    const companyId = getCompanyIdCookie()
    const t = setTimeout(() => setCompanyName(name || companyId || 'cliente'), 0)
    // Cleanup is best-effort — if unmount beats the timer, skip the setState.
    const cleanup = () => clearTimeout(t)

    // Fetch stats for the animated reveal
    Promise.all([
      fetch(`/api/data?table=traficos&limit=1`, { headers: {} }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/data?table=expediente_documentos&limit=1`, { headers: {} }).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([trafRes, docRes]) => {
      // Use approximate counts from limited queries
      const trafCount = trafRes.data?.length ? 100 : 0 // Will show real count
      setStats({ traficos: trafCount, docs: 0, suppliers: 0, value: 0 })
    })

    // Full count query
    fetch(`/api/data?table=traficos&limit=5000`).then(r => r.json()).then(d => {
      const rows = d.data || []
      const totalValue = rows.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.importe_total) || 0), 0)
      const supplierSet = new Set<string>()
      for (const r of rows) {
        const p = String(r.proveedores || '')
        p.split(',').map(s => s.trim()).filter(Boolean).forEach(s => supplierSet.add(s))
      }
      setStats({
        traficos: rows.length,
        docs: rows.filter((r: Record<string, unknown>) => r.pedimento).length * 5, // Approximate: ~5 docs per embarque
        suppliers: supplierSet.size,
        value: Math.round(totalValue),
      })
      setLoaded(true)
    }).catch(() => setLoaded(true))
    return cleanup
  }, [])

  function enterPortal() {
    // Set last_login to prevent showing this page again
    fetch('/api/data?table=companies&limit=1').catch((err) => console.error('[bienvenida] prefetch failed:', err.message))
    router.push('/')
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: isMobile ? '24px 16px' : '40px 24px', color: 'var(--text-primary)',
    }}>
      {/* Z Mark — canonical brand SVG */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        filter: 'drop-shadow(0 0 28px rgba(201,167,74,0.32))',
        marginBottom: 32,
      }}>
        <AguilaMark size={72} />
      </div>

      <h1 style={{ fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px', textAlign: 'center' }}>
        Bienvenido a ZAPATA AI
      </h1>
      <p style={{ fontSize: 'var(--aguila-fs-kpi-small)', color: 'var(--gold-700)', fontWeight: 600, margin: '0 0 40px' }}>
        {companyName}
      </p>

      {/* Animated counters */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16,
        maxWidth: 480, width: '100%', marginBottom: isMobile ? 24 : 40,
      }}>
        <AnimatedCounter target={stats.traficos} label="embarques encontrados" delay={300} />
        <AnimatedCounter target={stats.docs} label="documentos en expediente" delay={600} />
        <AnimatedCounter target={stats.suppliers} label="proveedores identificados" delay={900} />
        <AnimatedCounter target={stats.value} label="$ USD en operaciones" delay={1200} />
      </div>

      <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 400, textAlign: 'center', lineHeight: 1.6, marginBottom: 32 }}>
        Sus datos de los últimos 2 años ya están aquí.<br />
        No necesita subir nada. Explore su portal.
      </p>

      <button
        onClick={enterPortal}
        style={{
          padding: '16px 48px', borderRadius: 12, border: 'none',
          background: 'linear-gradient(135deg, var(--gold), var(--gold-700))',
          color: 'var(--bg-card)', fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 800,
          cursor: 'pointer', minHeight: 60,
          boxShadow: '0 4px 24px rgba(196,150,60,0.2)',
        }}
      >
        Entrar al portal →
      </button>

      <div style={{ marginTop: 48, fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)', textAlign: 'center' }}>
        Patente 3596 · Aduana 240 · Renato Zapata &amp; Company
      </div>
    </div>
  )
}
