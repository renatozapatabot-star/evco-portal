'use client';

import { Search, Bell } from 'lucide-react';
import { useNotificationBadge } from '@/hooks/use-notifications';

type StatusLevel = 'ok' | 'warning' | 'alert';

interface TopBarProps {
  /** Status message shown in the pill */
  statusMessage?: string;
  /** Status level controls color */
  statusLevel?: StatusLevel;
  /** MVE countdown days (null to hide) */
  mveDays?: number | null;
  /** Current date string */
  dateString?: string;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Search handler */
  onSearch?: (query: string) => void;
  /** Show notification bell (operator only) */
  showNotifications?: boolean;
}

function formatDate(): string {
  const d = new Date();
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
  ];
  return `${dayNames[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function TopBar({
  statusMessage = 'Todo en orden',
  statusLevel = 'ok',
  mveDays = null,
  dateString,
  searchPlaceholder = 'Buscar tráfico, pedimento...',
  onSearch,
  showNotifications = false,
}: TopBarProps) {
  const displayDate = dateString || formatDate();
  const { unreadCount } = useNotificationBadge();
  const badgeText = unreadCount === 0 ? null : unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <header className="cruz-topbar">
      <div className="topbar-search topbar-search-trigger" onClick={() => {
        // Trigger command palette via Cmd+K keyboard event
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
      }}>
        <Search size={14} className="topbar-search-icon" />
        <input
          type="text"
          placeholder="Buscar tráfico... (⌘K)"
          readOnly
          className="topbar-search-trigger"
        />
      </div>

      <div className="topbar-right">
        {/* Status pill */}
        <div className={`topbar-status ${statusLevel}`}>
          <span className="topbar-status-dot" />
          {statusMessage}
        </div>

        {/* MVE countdown badge */}
        {mveDays !== null && (
          <span className="topbar-mve-badge">
            MVE {mveDays}d
          </span>
        )}

        {/* Date */}
        <span className="topbar-date font-mono">{displayDate}</span>

        {/* Notification bell with badge */}
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
