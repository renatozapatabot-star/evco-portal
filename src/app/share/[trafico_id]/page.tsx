import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PORTAL_DATE_FROM } from '@/lib/data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface TraficoPreview {
  trafico: string
  estatus: string | null
  importe_total: number | null
  descripcion_mercancia: string | null
  moneda: string | null
  company_id: string | null
}

async function fetchPreview(traficoId: string): Promise<TraficoPreview | null> {
  const { data } = await supabase
    .from('traficos')
    .select('trafico, estatus, importe_total, descripcion_mercancia, moneda, company_id')
    .eq('trafico', traficoId)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .maybeSingle()
  return data
}

function truncate(s: string | null, max: number): string {
  if (!s) return '—'
  return s.length > max ? s.slice(0, max) + '…' : s
}

function fmtAmount(n: number | null, currency: string | null): string {
  if (n == null) return '—'
  const cur = currency ?? 'USD'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${cur}`
}

export async function generateMetadata(
  { params }: { params: Promise<{ trafico_id: string }> }
): Promise<Metadata> {
  const { trafico_id } = await params
  const id = decodeURIComponent(trafico_id)
  const t = await fetchPreview(id)

  if (!t) {
    return { title: `Embarque · PORTAL` }
  }

  const desc = [
    t.estatus ?? 'En Proceso',
    fmtAmount(t.importe_total, t.moneda),
    t.descripcion_mercancia,
  ].filter(Boolean).join(' · ')

  return {
    title: `Embarque ${id} · PORTAL`,
    description: desc,
    openGraph: {
      title: `Embarque ${id} · PORTAL`,
      description: desc,
      siteName: 'PORTAL · Renato Zapata & Co.',
      type: 'website',
    },
  }
}

export default async function SharePage(
  { params }: { params: Promise<{ trafico_id: string }> }
) {
  const { trafico_id } = await params
  const id = decodeURIComponent(trafico_id)

  // If already authenticated, redirect straight to embarque detail
  const cookieStore = await cookies()
  const isAuth = cookieStore.get('portal_auth')?.value === 'authenticated'
  if (isAuth) {
    redirect(`/embarques/${encodeURIComponent(id)}`)
  }

  // Fetch minimal preview (no auth required — only basic fields)
  const t = await fetchPreview(id)

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--navy-900, #0B1623)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Z watermark */}
      <div style={{
        position: 'absolute', bottom: -40, right: -40,
        fontSize: 280, fontWeight: 800,
        fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
        color: 'rgba(212,168,67,0.04)',
        lineHeight: 1, pointerEvents: 'none', userSelect: 'none',
      }}>
        Z
      </div>

      <div style={{
        width: '100%',
        maxWidth: 420,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 'var(--aguila-fs-section)',
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: 'var(--gold)',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            PORTAL
          </div>
          <div style={{
            fontSize: 'var(--aguila-fs-compact)',
            color: 'var(--portal-fg-4)',
            fontWeight: 500,
          }}>
            Renato Zapata &amp; Company
          </div>
        </div>

        {/* Preview Card */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          {t ? (
            <>
              <div>
                <div style={{
                  fontSize: 'var(--aguila-fs-meta)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  marginBottom: 6,
                }}>
                  Embarque compartido
                </div>
                <div style={{
                  fontSize: 'var(--aguila-fs-headline)',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                }}>
                  {id}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}>
                <div>
                  <div style={{
                    fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4,
                  }}>
                    Estatus
                  </div>
                  <div style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 'var(--aguila-fs-compact)',
                    fontWeight: 600,
                    background: 'rgba(192,197,206,0.06)',
                    color: '#B45309',
                    border: '1px solid #FED7AA',
                  }}>
                    {t.estatus ?? 'En Proceso'}
                  </div>
                </div>
                <div>
                  <div style={{
                    fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4,
                  }}>
                    Valor
                  </div>
                  <div style={{
                    fontSize: 'var(--aguila-fs-body-lg)',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                  }}>
                    {fmtAmount(t.importe_total, t.moneda)}
                  </div>
                </div>
                <div>
                  <div style={{
                    fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4,
                  }}>
                    Mercancía
                  </div>
                  <div style={{
                    fontSize: 'var(--aguila-fs-body)',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}>
                    {truncate(t.descripcion_mercancia, 60)}
                  </div>
                </div>
                <div>
                  <div style={{
                    fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4,
                  }}>
                    Empresa
                  </div>
                  <div style={{
                    fontSize: 'var(--aguila-fs-body)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                  }}>
                    {t.company_id ?? '—'}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Embarque no encontrado
              </div>
              <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)' }}>
                El embarque solicitado no existe o está fuera de rango.
              </div>
            </div>
          )}

          {/* Login CTA */}
          <a
            href={`/login?next=${encodeURIComponent(`/embarques/${encodeURIComponent(id)}`)}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '14px 24px',
              minHeight: 60,
              borderRadius: 8,
              background: 'var(--gold)',
              color: 'var(--bg-card)',
              fontSize: 'var(--aguila-fs-section)',
              fontWeight: 700,
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'background 150ms',
            }}
          >
            Iniciar sesión para ver detalles
            <span style={{ fontSize: 'var(--aguila-fs-body-lg)' }}>→</span>
          </a>
        </div>

        {/* CRUZ CTA */}
        <div style={{ marginTop: 40, padding: '24px 20px', borderTop: '1px solid var(--border, #E8E5E0)', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-muted)', marginBottom: 8 }}>
            ¿Quiere esta visibilidad para sus importaciones?
          </p>
          <p style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Portal — Inteligencia aduanal en tiempo real
          </p>
          <p style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--text-muted)', marginTop: 4 }}>
            Renato Zapata &amp; Company · Patente 3596
          </p>
        </div>
      </div>
    </div>
  )
}
