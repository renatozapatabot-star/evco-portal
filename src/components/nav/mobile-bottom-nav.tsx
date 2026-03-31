'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MOBILE_INTERNAL_TABS, MOBILE_CLIENT_TABS, type UserRole } from './nav-config'
import { getCookieValue } from '@/lib/client-config'

export function MobileBottomNavNew() {
  const pathname = usePathname()
  const [role, setRole] = useState<UserRole>('client')

  useEffect(() => {
    const r = getCookieValue('user_role')
    if (r === 'admin') setRole('admin')
    else setRole('client')
  }, [])

  const tabs = role === 'admin' ? MOBILE_INTERNAL_TABS : MOBILE_CLIENT_TABS

  return (
    <nav className="mn-nav" aria-label="Navegacion movil">
      {tabs.map(tab => {
        const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`mn-tab ${active ? 'mn-active' : ''} ${tab.center ? 'mn-center' : ''}`}
          >
            <span className="mn-icon-wrap">
              {tab.center ? (
                <div className="mn-z">Z</div>
              ) : tab.icon ? (
                <tab.icon size={20} strokeWidth={1.6} />
              ) : null}
            </span>
            {tab.label && <span className="mn-label">{tab.label}</span>}
            {active && !tab.center && <span className="mn-dot" />}
          </Link>
        )
      })}
    </nav>
  )
}
