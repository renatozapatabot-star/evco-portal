'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { MOBILE_INTERNAL_TABS, MOBILE_CLIENT_TABS, type UserRole } from '@/components/nav/nav-config'
import { getCookieValue } from '@/lib/client-config'
import { CruzAvatar } from '@/components/command-center/CruzAvatar'
import { useStatusSentence } from '@/hooks/use-status-sentence'
import { getMoodFromCounts } from '@/components/command-center/MissionHeader'

export function MobileBottomNav() {
  const pathname = usePathname()
  const role: UserRole = (() => {
    if (typeof document === 'undefined') return 'client'
    const r = getCookieValue('user_role')
    if (r === 'admin' || r === 'broker') return r as UserRole
    return 'client'
  })()
  const status = useStatusSentence()

  const tabs = (role === 'admin' || role === 'broker') ? MOBILE_INTERNAL_TABS : MOBILE_CLIENT_TABS
  const mood = getMoodFromCounts(status.enProceso, status.urgentes)

  return (
    <nav className="mn-nav" aria-label="Navegacion movil">
      {tabs.map(tab => {
        const isCenter = !!tab.center
        const isBuscar = tab.href === '#buscar'
        const active = !isCenter && !isBuscar && (tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href))

        if (isCenter) {
          return (
            <button
              key="cruz-center"
              type="button"
              className="mn-tab mn-center"
              onClick={() => document.dispatchEvent(new CustomEvent('cruz:open-chat'))}
              aria-label="CRUZ AI"
            >
              <span className="mn-icon-wrap">
                <CruzAvatar size={36} mood={mood} />
              </span>
            </button>
          )
        }

        if (isBuscar) {
          return (
            <button
              key="buscar"
              type="button"
              className={`mn-tab`}
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              aria-label="Buscar"
            >
              <span className="mn-icon-wrap">
                {tab.icon && <tab.icon size={20} strokeWidth={1.6} />}
              </span>
              {tab.label && <span className="mn-label">{tab.label}</span>}
            </button>
          )
        }

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`mn-tab ${active ? 'mn-active' : ''}`}
          >
            <span className="mn-icon-wrap">
              {tab.icon ? (
                <tab.icon size={20} strokeWidth={1.6} />
              ) : null}
            </span>
            {tab.label && <span className="mn-label">{tab.label}</span>}
            {active && <span className="mn-dot" />}
          </Link>
        )
      })}
    </nav>
  )
}
