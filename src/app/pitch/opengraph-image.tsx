import { ImageResponse } from 'next/og'

/**
 * Open Graph social image for /pitch.
 *
 * Rendered by Next at build time into a PNG at /pitch/opengraph-image.
 * Served automatically as the <meta property="og:image"> when the URL
 * is unfurled on LinkedIn / Slack / WhatsApp / Twitter.
 *
 * 1200×630 is the standard OG size. Silver-on-black, display-serif
 * hero line, mono eyebrow, 22→2min deltas. No Tailwind / no custom
 * fonts — ImageResponse runs on the edge with a tiny runtime.
 */

export const runtime = 'edge'
export const alt = 'PORTAL — Despacho aduanal 10× más rápido · Patente 3596'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background:
            'radial-gradient(ellipse at 50% 30%, #141420 0%, #0a0a0c 55%, #050507 100%)',
          color: '#E8EAED',
          display: 'flex',
          flexDirection: 'column',
          padding: 64,
          position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: 'flex',
            fontSize: 18,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: '#7A7E86',
            fontFamily: 'monospace',
          }}
        >
          Renato Zapata &amp; Company · Est. 1941
        </div>

        {/* Hero headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 'auto',
            marginBottom: 'auto',
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: '-0.02em',
              color: '#E8EAED',
              display: 'flex',
            }}
          >
            Despacho aduanal
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: '-0.02em',
              color: '#22c55e',
              display: 'flex',
            }}
          >
            10× más rápido.
          </div>
        </div>

        {/* Delta strip */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 48 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(239,68,68,0.14)',
              border: '1px solid rgba(239,68,68,0.32)',
              borderRadius: 16,
              padding: '20px 28px',
              minWidth: 220,
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                color: '#ef4444',
                letterSpacing: '-0.02em',
                fontFamily: 'monospace',
              }}
            >
              22 min
            </div>
            <div style={{ fontSize: 14, color: '#7A7E86', marginTop: 4 }}>
              Proceso manual
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(34,197,94,0.14)',
              border: '1px solid rgba(34,197,94,0.30)',
              borderRadius: 16,
              padding: '20px 28px',
              minWidth: 220,
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                color: '#22c55e',
                letterSpacing: '-0.02em',
                fontFamily: 'monospace',
              }}
            >
              2 min
            </div>
            <div style={{ fontSize: 14, color: '#7A7E86', marginTop: 4 }}>
              Con PORTAL
            </div>
          </div>
        </div>

        {/* Footer identity */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 16,
            color: '#7A7E86',
            fontFamily: 'monospace',
            letterSpacing: '0.12em',
          }}
        >
          <div style={{ display: 'flex' }}>
            Patente 3596 · Aduana 240 · Laredo, TX
          </div>
          <div style={{ display: 'flex', color: '#C0C5CE', fontWeight: 700 }}>
            portal.renatozapata.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
