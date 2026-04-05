'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { GOLD } from '@/lib/design-system'
import { getClientClaveCookie, getCompanyIdCookie } from '@/lib/client-config'

type Notif = { id: string; type: string; title: string; sub: string; time: string; read: boolean; color: string }

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { const saved = localStorage.getItem('cruz-notif-read'); if (saved) setReadIds(new Set(JSON.parse(saved))) } catch {}
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const clientClave = getClientClaveCookie()
        const companyId = getCompanyIdCookie()
        const [trafRes, entRes, factRes] = await Promise.all([
          fetch(`/api/data?table=traficos&company_id=${companyId}&limit=200&order_by=fecha_llegada&order_dir=desc`).then(r => r.json()),
          fetch(`/api/data?table=entradas&cve_cliente=${clientClave}&limit=100&order_by=fecha_llegada_mercancia&order_dir=desc`).then(r => r.json()),
          fetch(`/api/data?table=aduanet_facturas&clave_cliente=${clientClave}&limit=50&order_by=fecha_pago&order_dir=desc`).then(r => r.json()),
        ])
        const traf = trafRes.data ?? trafRes ?? []
        const ent = entRes.data ?? entRes ?? []
        const fact = factRes.data ?? factRes ?? []
        const notifs: Notif[] = []

        // Detenidos
        traf.filter((t: any) => (t.estatus || '').toLowerCase().includes('hold') || (t.estatus || '').toLowerCase().includes('deten'))
          .slice(0, 5).forEach((t: any) => notifs.push({
            id: `det-${t.trafico}`, type: 'alert', title: `Detenido: ${t.trafico}`,
            sub: t.descripcion_mercancia?.substring(0, 40) || 'Tráfico detenido', time: t.fecha_llegada || '', read: false, color: '#EF4444',
          }))

        // Faltantes
        ent.filter((e: any) => e.tiene_faltantes).slice(0, 3).forEach((e: any) => notifs.push({
          id: `falt-${e.cve_entrada}`, type: 'warning', title: `Faltante: ${e.cve_entrada}`,
          sub: e.descripcion_mercancia?.substring(0, 40) || 'Entrada con faltantes', time: e.fecha_llegada_mercancia || '', read: false, color: 'var(--warning-500)',
        }))

        // Damaged
        ent.filter((e: any) => e.mercancia_danada).slice(0, 3).forEach((e: any) => notifs.push({
          id: `dmg-${e.cve_entrada}`, type: 'alert', title: `Daño: ${e.cve_entrada}`,
          sub: 'Mercancía dañada reportada', time: e.fecha_llegada_mercancia || '', read: false, color: '#EF4444',
        }))

        // IGI where T-MEC could apply
        const igiAlerts = fact.filter((f: any) => (f.igi || 0) > 0).slice(0, 3)
        igiAlerts.forEach((f: any) => notifs.push({
          id: `igi-${f.referencia}`, type: 'info', title: `IGI pagado: ${f.referencia}`,
          sub: `$${Number(f.igi || 0).toLocaleString('es-MX')} MXN — verificar T-MEC`, time: f.fecha_pago || '', read: false, color: GOLD,
        }))

        // En Proceso > 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
        traf.filter((t: any) => t.estatus === 'En Proceso' && t.fecha_llegada && t.fecha_llegada < sevenDaysAgo)
          .slice(0, 3).forEach((t: any) => notifs.push({
            id: `slow-${t.trafico}`, type: 'warning', title: `Lento: ${t.trafico}`,
            sub: `En Proceso > 7 días — llegó ${t.fecha_llegada}`, time: t.fecha_llegada, read: false, color: 'var(--warning-500)',
          }))

        setItems(notifs.map(n => ({ ...n, read: readIds.has(n.id) })))
      } catch {}
    }
    load()

    // Refresh notifications every 90 seconds
    const interval = setInterval(load, 90_000)
    return () => clearInterval(interval)
  }, [readIds])

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function markAllRead() {
    const ids = new Set(items.map(n => n.id))
    setReadIds(ids)
    localStorage.setItem('cruz-notif-read', JSON.stringify([...ids]))
    setItems(prev => prev.map(n => ({ ...n, read: true })))
  }

  const unread = items.filter(n => !n.read).length

  function fmtTime(d: string) {
    if (!d) return ''
    try { return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) } catch { return d }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center justify-center rounded-[5px] transition-colors"
        style={{ width: 30, height: 30, background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative' }}>
        <Bell size={15} strokeWidth={1.8} style={{ color: 'var(--text-muted)' }} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: '50%',
            background: '#EF4444', color: '#fff', fontSize: 8, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 360,
          background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 10,
          boxShadow: 'var(--shadow-lg)', zIndex: 1000, overflow: 'hidden', maxHeight: 440 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px',
            borderBottom: '1px solid var(--border-primary)' }}>
            <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>Notificaciones</span>
            {unread > 0 && (
              <button onClick={markAllRead}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                Marcar todo leído
              </button>
            )}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: '32px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Sin notificaciones</div>
            ) : items.map(n => (
              <div key={n.id} style={{ display: 'flex', gap: 10, padding: '10px 14px',
                borderBottom: '1px solid var(--border-light)', background: n.read ? 'transparent' : 'rgba(201,168,76,0.04)',
                cursor: 'pointer' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.color, marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>{n.title}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>{fmtTime(n.time)}</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
