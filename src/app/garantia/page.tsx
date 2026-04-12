'use client'

import { Shield, Clock, FileText, Award } from 'lucide-react'
import Link from 'next/link'
import { useIsMobile } from '@/hooks/use-mobile'

/**
 * /garantia — The CRUZ Guarantee (BUILD 160)
 * Nobody else guarantees customs clearance.
 * CRUZ guarantees it because the system prevents failures.
 */
export default function GarantiaPage() {
  const isMobile = useIsMobile()
  const guarantees = [
    {
      icon: <Clock size={28} style={{ color: 'var(--gold)' }} />,
      title: 'Despacho 40% más rápido',
      detail: 'O le devolvemos la tarifa de ese mes',
      proof: 'Respaldado por datos verificados de 32,000+ operaciones',
    },
    {
      icon: <Shield size={28} style={{ color: 'var(--success)' }} />,
      title: 'Cero multas por errores',
      detail: 'O cubrimos la penalización',
      proof: 'Validación automática pre-despacho con AGUILA AI',
    },
    {
      icon: <FileText size={28} style={{ color: 'var(--info)' }} />,
      title: 'Documentos completos antes del cruce',
      detail: 'O el despacho es sin cargo',
      proof: 'Solicitud automática + seguimiento en tiempo real',
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: isMobile ? '32px 16px' : '60px 24px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 16, background: 'rgba(196,150,60,0.08)', border: '2px solid rgba(196,150,60,0.2)', marginBottom: 20 }}>
            <Award size={32} style={{ color: 'var(--gold)' }} />
          </div>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, margin: '0 0 12px' }}>
            Garantía AGUILA
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
            Respaldada por 80 años de operación y datos verificados de Patente 3596.
          </p>
        </div>

        {/* Guarantees */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 48 }}>
          {guarantees.map((g, i) => (
            <div key={i} className="card card-enter" style={{
              padding: '28px 24px',
              borderLeft: '4px solid var(--gold)',
              animationDelay: `${i * 100}ms`,
            }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>{g.icon}</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {g.title}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gold-dark)', marginBottom: 8 }}>
                    {g.detail}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {g.proof}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Link href="/resultados" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px 40px', minHeight: 60, borderRadius: 14,
            background: 'var(--gold)', color: 'var(--bg-card)',
            fontSize: 16, fontWeight: 700, textDecoration: 'none',
          }}>
            Ver resultados verificados →
          </Link>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          Renato Zapata & Company · Patente 3596 · Aduana 240 · Est. 1941
        </div>
      </div>
    </div>
  )
}
