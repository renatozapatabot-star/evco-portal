import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import {
  BORDER,
  GLASS_BLUR,
  GLASS_SHADOW,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Cómo facturar',
    body:
      'Abre "Pendientes de facturar" desde el cockpit. Cada renglón corresponde a un embarque cruzado que aún no tiene factura emitida. Al seleccionarlo, Portal pre-llena concepto, importe y tipo de cambio desde el pedimento. Revisa, ajusta si hace falta, y emite.',
  },
  {
    title: 'Cómo registrar un pago',
    body:
      'Desde "Cuentas por cobrar" selecciona la factura y usa el botón "Marcar como pagada". Si el pago es parcial, captura el monto aplicado — el saldo queda abierto automáticamente. Los estados de cuenta se recalculan en tiempo real.',
  },
  {
    title: 'Contacto',
    body:
      'Para dudas fiscales o correcciones mayores, contacta a Renato IV por WhatsApp. Si un embarque aparece en pendientes pero ya se facturó externamente, márcalo como "facturado fuera de sistema" para no ensuciar el conteo.',
  },
]

export default async function ContabilidadAyudaPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)

  if (!session) redirect('/login')
  if (!['contabilidad', 'admin', 'broker'].includes(session.role)) redirect('/inicio')

  return (
    <div style={{ padding: '24px 0', maxWidth: 720, margin: '0 auto', color: TEXT_PRIMARY }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontFamily: 'var(--font-geist-sans)',
          fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 800, letterSpacing: '-0.03em', margin: 0,
        }}>
          Ayuda
        </h1>
        <p style={{ fontSize: 'var(--aguila-fs-section)', color: TEXT_SECONDARY, marginTop: 6, marginBottom: 0 }}>
          Guía rápida para contabilidad.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {SECTIONS.map((section) => (
          <div
            key={section.title}
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: `blur(${GLASS_BLUR})`,
              WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
              border: `1px solid ${BORDER}`,
              borderRadius: 20,
              padding: 20,
              boxShadow: GLASS_SHADOW,
            }}
          >
            <div style={{
              fontSize: 'var(--aguila-fs-label)', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: TEXT_MUTED, marginBottom: 8,
            }}>
              {section.title}
            </div>
            <p style={{
              fontSize: 'var(--aguila-fs-section)', color: TEXT_SECONDARY, lineHeight: 1.55, margin: 0,
            }}>
              {section.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
