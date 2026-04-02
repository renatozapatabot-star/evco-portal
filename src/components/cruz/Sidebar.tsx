'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Inbox,
  Truck,
  FileText,
  BookOpen,
  BarChart3,
  FolderOpen,
  Zap,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import type { ReactNode } from 'react';

// ── Nav configuration per portal type ──

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const ICON_SIZE = 16;

const operatorNav: NavSection[] = [
  {
    title: 'Operaciones',
    items: [
      { label: 'Entradas',     href: '/entradas',     icon: <Inbox size={ICON_SIZE} /> },
      { label: 'Tráficos',     href: '/traficos',     icon: <Truck size={ICON_SIZE} /> },
      { label: 'Pedimentos',   href: '/pedimentos',   icon: <FileText size={ICON_SIZE} /> },
      { label: 'Catálogo',     href: '/catalogo',     icon: <BookOpen size={ICON_SIZE} /> },
      { label: 'Reportes',     href: '/reportes',     icon: <BarChart3 size={ICON_SIZE} /> },
      { label: 'Expedientes',  href: '/expedientes',  icon: <FolderOpen size={ICON_SIZE} /> },
    ],
  },
  {
    title: 'Inteligencia',
    items: [
      { label: 'CRUZ AI', href: '/cruz', icon: <Zap size={ICON_SIZE} /> },
    ],
  },
];

const clientNav: NavSection[] = [
  {
    title: 'Embarques',
    items: [
      { label: 'Entradas',   href: '/entradas',   icon: <Inbox size={ICON_SIZE} /> },
      { label: 'Tráficos',   href: '/traficos',   icon: <Truck size={ICON_SIZE} /> },
      { label: 'Pedimentos', href: '/pedimentos', icon: <FileText size={ICON_SIZE} /> },
    ],
  },
  {
    title: 'Documentos',
    items: [
      { label: 'Expedientes', href: '/expedientes', icon: <FolderOpen size={ICON_SIZE} /> },
      { label: 'Reportes',    href: '/reportes',    icon: <BarChart3 size={ICON_SIZE} /> },
    ],
  },
];

interface SidebarProps {
  portalType: 'operator' | 'client';
  clientName?: string;
  clientInitials?: string;
  clientRole?: string;
  companyName?: string;
  patente?: string;
  onLogout?: () => void;
}

export default function Sidebar({
  portalType,
  clientName = 'MAFESA',
  clientInitials = 'MF',
  clientRole = 'Portal de cliente',
  companyName = 'Renato Zapata & Co.',
  patente = '3596',
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  const navSections = portalType === 'operator' ? operatorNav : clientNav;

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const match = document.cookie.match(/(^| )sidebar_collapsed=([^;]+)/);
    if (match?.[2] === 'true') setCollapsed(true);
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `sidebar_collapsed=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
  }

  return (
    <aside className={`cruz-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-inner">
          <div className="sidebar-logo-mark">Z</div>
          {!collapsed && <div className="sidebar-logo-text">CRUZ</div>}
        </div>

        {/* Client identity block */}
        {portalType === 'client' && !collapsed && (
          <div className="sidebar-client">
            <div className="sidebar-avatar">{clientInitials}</div>
            <div>
              <div className="sidebar-client-name">
                {decodeURIComponent(clientName)}
              </div>
              <div className="sidebar-client-role">{clientRole}</div>
            </div>
          </div>
        )}
        {portalType === 'client' && collapsed && (
          <div className="sidebar-avatar-center">
            <div className="sidebar-avatar">{clientInitials}</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div key={section.title}>
            {!collapsed && <div className="sidebar-nav-label">{section.title}</div>}
            {section.items.map((item) => {
              const isActive = pathname === item.href
                || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {!collapsed && item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <button
        onClick={toggleCollapse}
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        className="sidebar-collapse-btn"
      >
        {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        {!collapsed && 'Colapsar'}
      </button>

      {/* Footer */}
      <div className="sidebar-footer">
        {portalType === 'operator' ? (
          <div>
            {!collapsed && (
              <>
                <div className="sidebar-footer-firm">
                  {decodeURIComponent(companyName)}
                </div>
                <div className="sidebar-client-role">
                  Operador · Patente {patente}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {!collapsed && (
              <div>
                <div className="sidebar-footer-text">
                  Renato Zapata &amp; Company
                </div>
                <div className="sidebar-footer-patente-line">
                  Patente {patente} · Aduana 240 · Est. 1941
                </div>
              </div>
            )}
            <button
              className="sidebar-footer-link"
              onClick={onLogout}
              title={collapsed ? 'Salir' : undefined}
            >
              <LogOut size={12} />
              {!collapsed && 'Salir'}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
