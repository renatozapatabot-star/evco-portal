'use client'
import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import { CLIENT_NAME, CLIENT_CLAVE, COMPANY_ID } from '@/lib/client-config'
import { SearchBar } from '@/components/layout/search-bar'
import { daysUntilMVE, mveIsUrgent } from '@/lib/compliance-dates'
import { fmtDate } from '@/lib/format-utils'
import { NightModeToggle } from '@/components/NightModeToggle'

function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(iv)
  }, [])
  const time = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  return <span className="tb-date">{fmtDate(now)} · {time}</span>
}

export default function TopBar() {
  const mveDays = daysUntilMVE()
  const [alertCount, setAlertCount] = useState(0)
  const [lastSync, setLastSync] = useState('')

  useEffect(() => {
    fetch('/api/status-summary').then(r => r.json())
      .then(d => setAlertCount((d.urgentes || 0) + (d.enProceso > 50 ? 1 : 0)))
      .catch(() => {})

    fetch(`/api/data?table=traficos&company_id=${COMPANY_ID}&select=updated_at&limit=1&order_by=updated_at&order_dir=desc`)
      .then(r => r.json())
      .then(d => {
        const ts = d.data?.[0]?.updated_at
        if (ts) {
          const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
          if (mins < 60) setLastSync(`${mins}m`)
          else if (mins < 1440) setLastSync(`${Math.floor(mins / 60)}h`)
          else setLastSync(`${Math.floor(mins / 1440)}d`)
        }
      }).catch(() => {})
  }, [])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span className="tb-company">{CLIENT_NAME}</span>
        <span className="tb-pipe" />
        <span className="tb-meta">{CLIENT_CLAVE}</span>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <SearchBar />
      </div>

      <div className="tb-right">
        {mveIsUrgent() && (
          <div className="mve-badge">
            <span className="mve-dot" />
            MVE {mveDays}d
          </div>
        )}
        <LiveClock />
        {lastSync && (
          <span style={{
            fontSize: 10, fontFamily: 'var(--font-mono)',
            color: lastSync.includes('d') ? 'var(--danger)' : 'var(--n-400)',
          }}>
            sync {lastSync}
          </span>
        )}
        <Link href="/alertas" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 5, textDecoration: 'none' }}>
          <Bell size={15} strokeWidth={1.8} style={{ color: 'var(--n-400)' }} />
          {alertCount > 0 && (
            <span style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: '50%',
              background: '#EF4444', color: '#fff', fontSize: 8, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{alertCount > 9 ? '9+' : alertCount}</span>
          )}
        </Link>
        <NightModeToggle />
        <div className="tb-avatar">RZ</div>
      </div>
    </>
  )
}
