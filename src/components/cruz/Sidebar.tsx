'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { AduanaMark } from '@/components/command-center/CruzMark';
import type { ReactNode } from 'react';
import { INTERNAL_GROUPS, CLIENT_NAV, CLIENT_GROUPS } from '@/components/nav/nav-config';
import { ActivityStrip } from '@/components/ActivityStrip';

// ── Nav types ──

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const ICON_SIZE = 16;

// Build sidebar sections from nav-config.ts (single source of truth)
const operatorNav: NavSection[] = INTERNAL_GROUPS.map(g => ({
  title: g.label,
  items: g.children.map(c => ({
    label: c.label,
    href: c.href,
    icon: <c.icon size={ICON_SIZE} />,
  })),
}));

const clientTopNav: NavSection = {
  title: '',
  items: CLIENT_NAV.map(c => ({
    label: c.label,
    href: c.href,
    icon: <c.icon size={ICON_SIZE} />,
  })),
};

const clientGroupNav: NavSection[] = CLIENT_GROUPS.map(g => ({
  title: g.label,
  items: g.children.map(c => ({
    label: c.label,
    href: c.href,
    icon: <c.icon size={ICON_SIZE} />,
  })),
}));

const clientNav: NavSection[] = [
  clientTopNav,
  ...clientGroupNav,
];

interface SidebarProps {
  portalType: 'operator' | 'client';
  clientName?: string;
  clientInitials?: string;
  clientRole?: string;
  companyName?: string;
  patente?: string;
  onLogout?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({
  portalType,
  clientName = '',
  clientInitials = '',
  clientRole = 'Portal de cliente',
  companyName = 'Renato Zapata & Co.',
  patente = '3596',
  onLogout,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const navSections = portalType === 'operator' ? operatorNav : clientNav;

  return (
    <aside className={`aduana-sidebar${mobileOpen ? ' mobile-open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-inner">
          <div className="sidebar-logo-text">ADUANA</div>
        </div>

        {/* Client identity block */}
        {portalType === 'client' && clientName && (
          <div className="sidebar-client">
            <div>
              <div className="sidebar-client-name">
                {decodeURIComponent(clientName)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Menú principal">
        {navSections.map((section) => (
          <div key={section.title}>
            <div className="sidebar-nav-label">{section.title}</div>
            {section.items.map((item) => {
              const isActive = pathname === item.href
                || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={onMobileClose}
                  aria-current={isActive ? 'page' : undefined}
                  style={{ position: 'relative' }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {item.badge && item.badge > 0 && (
                    <span className="nav-badge" style={{ position: 'absolute', top: 6, right: 8 }}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Activity feed */}
      {portalType === 'operator' && <ActivityStrip />}

      {/* Footer */}
      <div className="sidebar-footer">
        {portalType === 'operator' ? (
          <div>
            <div className="sidebar-footer-firm">
              {decodeURIComponent(companyName)}
            </div>
            <div className="sidebar-client-role">
              Operador · Patente {patente}
            </div>
          </div>
        ) : (
          <>
            <div>
              <div className="sidebar-footer-text">
                Renato Zapata &amp; Company
              </div>
              <div className="sidebar-footer-patente-line">
                Patente {patente} · Aduana 240 · Est. 1941
              </div>
            </div>
            <button
              className="sidebar-footer-link"
              onClick={onLogout}
            >
              <LogOut size={12} />
              Salir
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
