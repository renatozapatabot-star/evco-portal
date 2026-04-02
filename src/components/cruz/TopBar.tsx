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
  const day = String(d.getDate()).padStart(2, '0');
  const months = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ];
  const month = months[d.getMonth()];
  return `${day} ${month} ${d.getFullYear()}`;
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
      <div className="topbar-search" onClick={() => {
        // Trigger command palette via Cmd+K keyboard event
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
      }} style={{ cursor: 'pointer' }}>
        <Search size={14} className="topbar-search-icon" />
        <input
          type="text"
          placeholder="Buscar tráfico... (⌘K)"
          readOnly
          style={{ cursor: 'pointer' }}
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
        <span className="topbar-date">{displayDate}</span>

        {/* Notification bell with badge */}
        {showNotifications && (
          <button
            className="btn-outline btn-sm"
            style={{ padding: '6px 8px', border: 'none', position: 'relative' }}
            aria-label={`${unreadCount} notificaciones sin leer`}
          >
            <Bell size={16} />
            {badgeText && (
              <span className="badge-bounce" style={{
                position: 'absolute', top: -4, right: -4,
                background: 'var(--danger-500)', color: '#FFFFFF',
                fontSize: 10, fontWeight: 700,
                borderRadius: 9999, minWidth: 18, height: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px',
                fontFamily: 'var(--font-mono)',
              }}>
                {badgeText}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
