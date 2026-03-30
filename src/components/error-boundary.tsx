'use client'
import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props { children: ReactNode; fallbackTitle?: string }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error } }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ margin: '24px 0' }}>
          <div className="empty-state">
            <div className="empty-icon" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-b)' }}>
              <AlertTriangle size={22} style={{ color: 'var(--danger)' }} />
            </div>
            <p className="empty-title">{this.props.fallbackTitle || 'Error al cargar datos'}</p>
            <p className="empty-desc">{this.state.error?.message || 'Ocurrió un error inesperado.'}</p>
            <button className="act-btn" style={{ marginTop: 16 }} onClick={() => { this.setState({ hasError: false }); window.location.reload() }}>
              <RefreshCw size={13} />Reintentar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
