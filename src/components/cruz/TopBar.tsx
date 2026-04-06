'use client';

import { Search, Bell, Menu } from 'lucide-react';
import { useNotificationBadge } from '@/hooks/use-notifications';

interface TopBarProps {
  /** Show notification bell (operator only) */
  showNotifications?: boolean;
  /** Mobile hamburger toggle */
  onMenuToggle?: () => void;
}

export default function TopBar({
  showNotifications = false,
  onMenuToggle,
}: TopBarProps) {
  const { unreadCount } = useNotificationBadge();
  const badgeText = unreadCount === 0 ? null : unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <header className="cruz-topbar">
      {onMenuToggle && (
        <button className="topbar-hamburger" onClick={onMenuToggle} aria-label="Abrir menú">
          <Menu size={20} />
        </button>
      )}
      <div className="topbar-search topbar-search-trigger topbar-search-prominent" onClick={() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
      }}>
        <Search size={16} className="topbar-search-icon" />
        <input
          type="text"
          placeholder="Buscar tráfico, pedimento, documento... (⌘K)"
          readOnly
          className="topbar-search-trigger"
        />
      </div>

      <div className="topbar-right">
        {showNotifications && (
          <button
            className="topbar-bell-btn"
            aria-label={`${unreadCount} notificaciones sin leer`}
          >
            <Bell size={16} />
            {badgeText && (
              <span className="topbar-bell-badge badge-bounce">
                {badgeText}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
