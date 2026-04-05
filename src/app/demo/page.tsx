'use client'

import { GOLD } from '@/lib/design-system'
import { getClientNameCookie } from '@/lib/client-config'

export default function DemoPage() {
  const clientName = getClientNameCookie()
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-geist-sans)', padding: 40 }}>
      <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(196,150,60,0.08)', border: '1.5px solid rgba(196,150,60,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: GOLD }}>RZ</span>
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>Plataforma de Inteligencia CRUZ</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32, textAlign: 'center', maxWidth: 480 }}>
        Inteligencia Regulatoria y Aduanera · Renato Zapata & Company.<br />
        Patente 3596 · Aduana 240 Nuevo Laredo · Laredo, Texas
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 700, width: '100%', marginBottom: 40 }}>
        {[
          { label: 'Tráficos', value: '32,247', sub: 'Registros históricos' },
          { label: 'Entradas', value: '64,489', sub: 'Recibos de bodega' },
          { label: 'Pedimentos', value: '1,962', sub: 'Declaraciones aduanales' },
          { label: 'Fracciones', value: '103', sub: 'Códigos arancelarios' },
          { label: 'Proveedores', value: '71', sub: 'Proveedores activos' },
          { label: 'Scripts', value: '31', sub: 'Procesos automatizados' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: GOLD, fontFamily: 'var(--font-jetbrains-mono)' }}>{k.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{k.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 40 }}>
        {[
          { label: `Portal ${clientName.split(' ')[0]}`, href: '/', desc: 'Client-facing portal' },
          { label: 'CRUZ Dashboard', href: '/cruz', desc: 'Internal ops view' },
          { label: 'System Status', href: '/status', desc: 'Health monitoring' },
        ].map(l => (
          <a key={l.href} href={l.href} style={{ background: 'rgba(196,150,60,0.08)', border: '1px solid rgba(196,150,60,0.25)', borderRadius: 10, padding: '14px 24px', textDecoration: 'none', textAlign: 'center', transition: 'border-color 0.15s' }}>
            <div style={{ color: GOLD, fontSize: 14, fontWeight: 700 }}>{l.label}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4 }}>{l.desc}</div>
          </a>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 600 }}>
        {['Tráficos', 'Entradas', 'Pedimentos', 'Expedientes', 'Reportes', 'Cuentas', 'OCA', 'USMCA', 'Cotización', 'Proveedores', 'Anexo 24', 'SOIA', 'Carriers', 'IMMEX', 'Calendario', 'MVE'].map(f => (
          <span key={f} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text-secondary)' }}>{f}</span>
        ))}
      </div>

      <div style={{ marginTop: 40, color: 'var(--text-muted)', fontSize: 10, textAlign: 'center' }}>
        CRUZ v2 · Renato Zapata & Company · Grupo Aduanal · Established 1940<br />
        31 automated scripts · 17 cron jobs · 36+ portal routes · Real-time Supabase + GlobalPC WSDL
      </div>
    </div>
  )
}
