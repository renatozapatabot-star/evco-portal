import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import {
  GlassCard,
  AguilaMetric,
  AguilaBeforeAfter,
  AguilaTestimonial,
  AguilaCTA,
} from '@/components/aguila'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { PitchLeadForm } from './PitchLeadForm'

export const metadata: Metadata = {
  title: 'PORTAL — Inteligencia Aduanera · Patente 3596',
  description:
    'Despacho aduanal 10× más rápido para importadores mexicanos. EVCO Plastics: 22 min → 2 min. Construido por dos personas con patente 3596.',
  openGraph: {
    title: 'PORTAL — Inteligencia Aduanera',
    description:
      'De 22 minutos a 2. Patente 3596. 85 años cruzando la frontera de Laredo.',
    type: 'website',
    siteName: 'Renato Zapata & Company',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PORTAL — Inteligencia Aduanera',
    description: 'De 22 minutos a 2. Patente 3596. Est. 1941.',
  },
}

export default function PitchPage() {
  return (
    <main
      className="aguila-dark aguila-canvas"
      style={{
        minHeight: '100vh',
        position: 'relative',
        paddingTop: 32,
        paddingBottom: 64,
      }}
    >
      <div className="aguila-aura" aria-hidden="true" />

      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '0 20px',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
        }}
      >
        {/* ── Hero ───────────────────────────────────────────── */}
        <section style={{ textAlign: 'center', paddingTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <AguilaMark size={64} />
          </div>
          <div
            style={{
              fontSize: 'var(--portal-fs-micro)',
              fontWeight: 700,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'var(--portal-fg-4)',
              fontFamily: 'var(--portal-font-mono)',
              marginBottom: 14,
            }}
          >
            Renato Zapata &amp; Company · Est. 1941
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--portal-font-display)',
              fontSize: 'clamp(32px, 5.5vw, 56px)',
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
              color: 'var(--portal-fg-1)',
            }}
          >
            Despacho aduanal
            <br />
            <span style={{ color: 'var(--portal-status-green-fg)' }}>10× más rápido.</span>
          </h1>
          <p
            style={{
              margin: '18px auto 0',
              maxWidth: 640,
              fontSize: 'var(--portal-fs-md)',
              color: 'var(--portal-fg-3)',
              lineHeight: 1.5,
            }}
          >
            Construido por dos personas con patente 3596 — para importadores
            mexicanos que están hartos de esperar horas por una clasificación
            arancelaria, una liberación, o una firma.
          </p>
        </section>

        {/* ── Before/After strip ─────────────────────────────── */}
        <section>
          <AguilaBeforeAfter
            title="Impacto medible"
            before="22 min"
            beforeLabel="Clasificación manual (antes)"
            after="2 min"
            afterLabel="Con PORTAL (hoy)"
          />
        </section>

        {/* ── Metrics row ────────────────────────────────────── */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 14,
          }}
        >
          <AguilaMetric
            label="Patente"
            value="3596"
            sub="Aduana 240 · Nuevo Laredo"
          />
          <AguilaMetric
            label="Fundado"
            value="1941"
            sub="85 años cruzando la frontera"
          />
          <AguilaMetric
            label="Liberación inmediata"
            value="98"
            unit="%"
            tone="positive"
            sub="Semáforo verde últimos 90 días"
          />
          <AguilaMetric
            label="SKUs activos"
            value="148,537"
            sub="EVCO Plastics catálogo"
          />
        </section>

        {/* ── Testimonial ────────────────────────────────────── */}
        <section>
          <AguilaTestimonial
            quote="Abro el portal a las 11 PM, veo todo en una pantalla, y me voy a dormir. Esto no existía antes."
            attribution="Ursula Banda"
            role="Dir. de Operaciones · EVCO Plastics"
          />
        </section>

        {/* ── What you get ───────────────────────────────────── */}
        <section>
          <h2
            className="portal-eyebrow"
            style={{
              fontSize: 'var(--portal-fs-sm)',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--portal-fg-4)',
              marginBottom: 14,
              textAlign: 'center',
            }}
          >
            Lo que ves el día uno
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 14,
            }}
          >
            <GlassCard tier="hero" padding={20}>
              <div
                style={{
                  fontSize: 'var(--portal-fs-lg)',
                  fontWeight: 600,
                  color: 'var(--portal-fg-1)',
                  marginBottom: 6,
                }}
              >
                Tu operación, en vivo
              </div>
              <div style={{ fontSize: 'var(--portal-fs-sm)', color: 'var(--portal-fg-4)', lineHeight: 1.5 }}>
                Tráficos activos, pedimentos pagados, semáforo verde — todo
                sincronizado cada 30 minutos desde la aduana.
              </div>
            </GlassCard>
            <GlassCard tier="hero" padding={20}>
              <div
                style={{
                  fontSize: 'var(--portal-fs-lg)',
                  fontWeight: 600,
                  color: 'var(--portal-fg-1)',
                  marginBottom: 6,
                }}
              >
                Clasificación con IA
              </div>
              <div style={{ fontSize: 'var(--portal-fs-sm)', color: 'var(--portal-fg-4)', lineHeight: 1.5 }}>
                Describe el producto una vez. La IA propone fracción
                arancelaria con fundamento legal. Tito revisa. Tú firmas.
              </div>
            </GlassCard>
            <GlassCard tier="hero" padding={20}>
              <div
                style={{
                  fontSize: 'var(--portal-fs-lg)',
                  fontWeight: 600,
                  color: 'var(--portal-fg-1)',
                  marginBottom: 6,
                }}
              >
                Tu Anexo 24 auditado
              </div>
              <div style={{ fontSize: 'var(--portal-fs-sm)', color: 'var(--portal-fg-4)', lineHeight: 1.5 }}>
                Cada SKU cruzado con el Formato 53 que ya entregaste al SAT.
                Sin Excel. Sin sorpresas en la siguiente auditoría.
              </div>
            </GlassCard>
          </div>
        </section>

        {/* ── CTA block ──────────────────────────────────────── */}
        <section style={{ paddingTop: 8 }}>
          <AguilaCTA
            title="Dale un vistazo antes de decidir."
            subtitle="Abre el demo público. Mismo cockpit. Datos ficticios de una empresa llamada DEMO PLASTICS. Sin registro. Sin email. Zero compromiso."
            primary={{
              label: 'Ver demo en vivo',
              href: '/demo/live',
              icon: <ArrowRight size={18} strokeWidth={2} />,
            }}
          />
        </section>

        {/* ── Inline lead capture ────────────────────────────── */}
        <section>
          <PitchLeadForm />
        </section>

        {/* ── Footer ─────────────────────────────────────────── */}
        <footer
          style={{
            marginTop: 40,
            paddingTop: 24,
            borderTop: '1px solid var(--portal-line-2)',
            textAlign: 'center',
            fontFamily: 'var(--portal-font-mono)',
            fontSize: 'var(--portal-fs-micro)',
            letterSpacing: '0.12em',
            color: 'var(--portal-fg-5)',
          }}
        >
          Patente 3596 · Aduana 240 · Laredo, TX · Est. 1941
        </footer>
      </div>
    </main>
  )
}
