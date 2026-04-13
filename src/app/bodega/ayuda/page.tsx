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

interface HelpSection {
  title: string
  body: string
  mailto?: { label: string; href: string }
}

const SECTIONS: HelpSection[] = [
  {
    title: 'Cómo subir documentos',
    body:
      'Entra a "Subir fotos" desde el cockpit o arrastra archivos al recuadro grande de la pantalla de inicio. El clasificador de AGUILA detecta factura, lista de empaque, BOL y certificado de origen automáticamente. Si un archivo no se reconoce, aparece en rojo para clasificación manual.',
  },
  {
    title: 'Cómo registrar una entrada nueva',
    body:
      'Si llega mercancía sin embarque previo, selecciona "Buscar embarque" para confirmar que no exista ya. Si realmente es nueva, avisa al operador de turno por el chat interno y sube las fotos de inmediato — el embarque se creará en el sistema y los documentos quedarán ligados.',
  },
  {
    title: 'Enviar documentos por email',
    body:
      'Si no tienes acceso al portal en este momento, reenvía los documentos a ai@renatozapata.com. El buzón está monitoreado 24/7 y el clasificador los enlazará al embarque correspondiente.',
    mailto: { label: 'Abrir correo a ai@renatozapata.com', href: 'mailto:ai@renatozapata.com?subject=Documentos%20de%20bodega' },
  },
  {
    title: 'Contacto',
    body:
      'Para cualquier problema operativo, escribe a Renato IV por WhatsApp. Para urgencias fuera de horario, también puedes enviar los documentos a ai@renatozapata.com — el correo se procesa automáticamente las 24 horas.',
  },
]

export default async function BodegaAyudaPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)

  if (!session) redirect('/login')
  if (session.role === 'client' || session.role === 'operator') redirect('/inicio')
  if (!['warehouse', 'admin', 'broker'].includes(session.role)) redirect('/login')

  return (
    <div style={{ padding: '24px 0', maxWidth: 720, margin: '0 auto', color: TEXT_PRIMARY }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontFamily: 'var(--font-geist-sans)',
          fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', margin: 0,
        }}>
          Ayuda
        </h1>
        <p style={{ fontSize: 14, color: TEXT_SECONDARY, marginTop: 6, marginBottom: 0 }}>
          Guía rápida para la bodega.
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
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: TEXT_MUTED, marginBottom: 8,
            }}>
              {section.title}
            </div>
            <p style={{
              fontSize: 14, color: TEXT_SECONDARY, lineHeight: 1.55, margin: 0,
            }}>
              {section.body}
            </p>
            {section.mailto && (
              <a
                href={section.mailto.href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 60,
                  padding: '0 20px',
                  marginTop: 12,
                  borderRadius: 14,
                  background: '#E8EAED',
                  color: '#0D0D0C',
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                {section.mailto.label}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
