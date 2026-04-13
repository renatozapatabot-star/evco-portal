'use client';

import type { TraficoStatus } from './design-tokens';
import { statusConfig } from './design-tokens';

// ── Status Badge ──

interface StatusBadgeProps {
  status: TraficoStatus;
}

const badgeClassMap: Record<TraficoStatus, string> = {
  en_proceso:     'badge-proceso',
  cruzado:        'badge-cruzado',
  docs_faltantes: 'badge-docs',
  detenido:       'badge-detenido',
  pendiente:      'badge-pendiente',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={`badge ${badgeClassMap[status]}`}>
      <span className="badge-dot" />
      {config.label}
    </span>
  );
}

// ── Docs Progress (5-dot bar) ──

interface DocsProgressProps {
  /** Total required docs for this embarque */
  total: number;
  /** Number of docs uploaded/verified */
  filled: number;
  /** Number of docs pending review */
  pending?: number;
}

export function DocsProgress({ total, filled, pending = 0 }: DocsProgressProps) {
  const missing = total - filled - pending;
  const dots: Array<'filled' | 'warn' | 'missing'> = [
    ...Array(filled).fill('filled' as const),
    ...Array(pending).fill('warn' as const),
    ...Array(Math.max(0, missing)).fill('missing' as const),
  ];

  return (
    <div className="docs-bar" title={`${filled}/${total} documentos`}>
      {dots.map((type, i) => (
        <span key={i} className={`docs-dot ${type}`} />
      ))}
    </div>
  );
}

// ── Stat Card ──

interface StatCardProps {
  label: string;
  value: string | number;
  note?: string;
  variant?: 'default' | 'alert' | 'success' | 'info';
}

export function StatCard({ label, value, note, variant = 'default' }: StatCardProps) {
  const valueClass = variant === 'default' ? '' : variant;
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${valueClass}`}>{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}

// ── Pedimento Display ──

interface PedimentoProps {
  numero?: string | null;
}

export function PedimentoDisplay({ numero }: PedimentoProps) {
  if (!numero) {
    return <span className="pedimento-pending">Pendiente</span>;
  }
  return <span className="pedimento-num">{numero}</span>;
}

// ── Status Banner (green all-clear / amber warning / red alert) ──

interface StatusBannerProps {
  level: 'ok' | 'warning' | 'alert';
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function StatusBanner({ level, title, subtitle, icon }: StatusBannerProps) {
  return (
    <div className={`status-banner ${level}`}>
      <div className="status-banner-icon">
        {icon || (level === 'ok' ? '✓' : level === 'warning' ? '!' : '✕')}
      </div>
      <div>
        <div className="status-banner-text">{title}</div>
        {subtitle && <div className="status-banner-sub">{subtitle}</div>}
      </div>
    </div>
  );
}

// ── Empty State ──

interface EmptyStateProps {
  icon?: React.ReactNode;
  text: string;
  hint?: string;
}

export function EmptyState({ icon, text, hint }: EmptyStateProps) {
  return (
    <div className="card empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <div className="empty-state-text">{text}</div>
      {hint && <div className="empty-state-hint">{hint}</div>}
    </div>
  );
}
