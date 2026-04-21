'use client'

import { AlertTriangle } from 'lucide-react'

interface ErrorCardProps {
  /** Context-specific error message */
  message: string
  onRetry?: () => void
}

/**
 * v2 ErrorCard — red left border, danger icon, retry button.
 * Uses CSS classes from globals.css (.error-card).
 */
export function ErrorCard({ message, onRetry }: ErrorCardProps) {
  return (
    <div className="error-card">
      <div className="error-card-icon">
        <AlertTriangle size={18} />
      </div>
      <div className="error-card-text">{message}</div>
      {onRetry && (
        <button className="error-card-retry" onClick={onRetry}>
          Reintentar →
        </button>
      )}
    </div>
  )
}
