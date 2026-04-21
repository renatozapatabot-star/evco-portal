/* CRUZ — Cruces Map module + Anexo 24 density view + Onboarding tour */

const { useState, useEffect, useRef, useMemo } = React;

/* =========================================================================
   CrucesMap — stylized US/MX border with bridge crossings + live shipments
   ========================================================================= */
const CrucesMap = () => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let raf;
    const tick = (t) => { setPhase((t / 4000) % 1); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const bridges = [
    { id: 'nl2', name: 'Nuevo Laredo II', x: 540, y: 320, wait: 8, st: 'ok', count: 4 },
    { id: 'col', name: 'Colombia', x: 495, y: 295, wait: 12, st: 'ok', count: 2 },
    { id: 'wtb', name: 'World Trade', x: 555, y: 328, wait: 34, st: 'warn', count: 1 },
    { id: 'phr', name: 'Pharr–Reynosa', x: 660, y: 370, wait: 22, st: 'ok', count: 3 },
    { id: 'juz', name: 'Cd. Juárez–Zaragoza', x: 310, y: 205, wait: 18, st: 'ok', count: 2 },
    { id: 'ots', name: 'Otay Mesa', x: 90,  y: 220, wait: 26, st: 'ok', count: 1 },
  ];

  const shipments = [
    { from: [560, 150], to: [540, 320], bridge: 'nl2' },   // Houston → NL2
    { from: [720, 300], to: [660, 370], bridge: 'phr' },
    { from: [140, 120], to: [ 90, 220], bridge: 'ots' },
  ];

  return (
    <div className="cruz-card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', borderBottom: '1px solid var(--cruz-line-1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="cruz-eyebrow">MAPA DE CRUCES · EN VIVO</span>
          <span className="cruz-pulse"/>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Hoy', '7d', '30d'].map((p, i) => (
            <button key={p} style={{
              padding: '4px 10px', fontSize: 'var(--cruz-fs-xs)',
              borderRadius: 'var(--cruz-r-1)',
              background: i === 0 ? 'var(--cruz-ink-3)' : 'transparent',
              color: i === 0 ? 'var(--cruz-fg-1)' : 'var(--cruz-fg-4)',
              border: i === 0 ? '1px solid var(--cruz-line-2)' : '1px solid transparent',
            }}>{p}</button>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', background: 'var(--cruz-ink-0)', aspectRatio: '16/7' }}>
        <svg viewBox="0 0 800 420" style={{ width: '100%', height: '100%', display: 'block' }}>
          <defs>
            <linearGradient id="mapGrid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--cruz-ink-0)"/>
              <stop offset="1" stopColor="var(--cruz-ink-1)"/>
            </linearGradient>
            <radialGradient id="glowUs" cx="0.5" cy="0.3" r="0.7">
              <stop offset="0" stopColor="rgba(255,255,255,0.04)"/>
              <stop offset="1" stopColor="transparent"/>
            </radialGradient>
          </defs>
          <rect width="800" height="420" fill="url(#mapGrid)"/>

          {/* Graticule */}
          {[...Array(8)].map((_, i) => (
            <line key={'h'+i} x1="0" x2="800" y1={i*60} y2={i*60} stroke="rgba(255,255,255,0.04)"/>
          ))}
          {[...Array(14)].map((_, i) => (
            <line key={'v'+i} y1="0" y2="420" x1={i*60} x2={i*60} stroke="rgba(255,255,255,0.04)"/>
          ))}

          {/* USA outline (stylized) */}
          <path d="M 20 80 L 100 70 L 180 60 L 260 55 L 360 60 L 460 70 L 560 80 L 640 95 L 720 115 L 780 140 L 780 250 L 720 270 L 660 280 L 600 285 L 560 300 L 540 320 L 520 315 L 495 295 L 460 290 L 410 285 L 360 280 L 310 270 L 280 260 L 240 240 L 200 225 L 160 215 L 120 210 L 90 220 L 60 215 L 30 200 L 20 160 Z"
            fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.18)" strokeWidth="1"/>

          {/* MX outline (stylized) */}
          <path d="M 90 220 L 120 210 L 160 215 L 200 225 L 240 240 L 280 260 L 310 270 L 360 280 L 410 285 L 460 290 L 495 295 L 540 320 L 560 328 L 580 335 L 620 350 L 660 370 L 680 390 L 660 410 L 600 410 L 520 395 L 440 380 L 360 365 L 300 350 L 240 335 L 200 325 L 160 310 L 130 290 L 100 265 Z"
            fill="rgba(80,200,150,0.04)" stroke="rgba(80,200,150,0.22)" strokeWidth="1"/>

          <rect width="800" height="420" fill="url(#glowUs)"/>

          {/* Border line — Rio Grande stylized */}
          <path d="M 90 220 L 160 215 L 240 240 L 310 270 L 410 285 L 495 295 L 540 320 L 560 328 L 620 350 L 660 370"
            fill="none" stroke="var(--cruz-green-3)" strokeWidth="1" strokeDasharray="2 4" opacity="0.5"/>

          {/* Labels */}
          <text x="360" y="110" fill="rgba(255,255,255,0.25)" fontFamily="var(--cruz-font-mono)" fontSize="9" letterSpacing="3">ESTADOS UNIDOS</text>
          <text x="360" y="385" fill="rgba(80,200,150,0.5)" fontFamily="var(--cruz-font-mono)" fontSize="9" letterSpacing="3">MÉXICO</text>

          {/* Shipment paths with moving pulse */}
          {shipments.map((s, i) => {
            const len = Math.hypot(s.to[0]-s.from[0], s.to[1]-s.from[1]);
            const t = (phase + i * 0.33) % 1;
            const px = s.from[0] + (s.to[0]-s.from[0]) * t;
            const py = s.from[1] + (s.to[1]-s.from[1]) * t;
            return (
              <g key={i}>
                <line x1={s.from[0]} y1={s.from[1]} x2={s.to[0]} y2={s.to[1]}
                  stroke="var(--cruz-green-2)" strokeWidth="0.8" opacity="0.35" strokeDasharray="3 4"/>
                <circle cx={px} cy={py} r="3" fill="var(--cruz-green-2)"/>
                <circle cx={px} cy={py} r="7" fill="var(--cruz-green-2)" opacity="0.2"/>
              </g>
            );
          })}

          {/* Bridge markers */}
          {bridges.map(b => {
            const color = b.st === 'warn' ? 'var(--cruz-amber)' : 'var(--cruz-green-2)';
            return (
              <g key={b.id}>
                <circle cx={b.x} cy={b.y} r="14" fill={color} opacity="0.08">
                  <animate attributeName="r" values="10;16;10" dur="2.4s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.2;0;0.2" dur="2.4s" repeatCount="indefinite"/>
                </circle>
                <circle cx={b.x} cy={b.y} r="5" fill={color}/>
                <circle cx={b.x} cy={b.y} r="5" fill="none" stroke={color} strokeWidth="1" opacity="0.8"/>
                <text x={b.x + 10} y={b.y - 8} fill="var(--cruz-fg-1)" fontFamily="var(--cruz-font-sans)" fontSize="10.5" fontWeight="500">
                  {b.name}
                </text>
                <text x={b.x + 10} y={b.y + 6} fill="var(--cruz-fg-4)" fontFamily="var(--cruz-font-mono)" fontSize="8.5" letterSpacing="1">
                  {b.wait}m · {b.count} {b.count === 1 ? 'cruce' : 'cruces'}
                </text>
              </g>
            );
          })}

          {/* Compass / coords HUD */}
          <g transform="translate(28, 28)" fontFamily="var(--cruz-font-mono)" fontSize="8" fill="rgba(255,255,255,0.35)" letterSpacing="1.5">
            <text>27.5060°N</text>
            <text y="10">99.5075°W</text>
            <text y="24">ZONA · TX / NL</text>
          </g>
          <g transform="translate(760, 404)" fontFamily="var(--cruz-font-mono)" fontSize="8" fill="rgba(255,255,255,0.3)" textAnchor="end" letterSpacing="1.5">
            <text>DATOS CBP · SAT · CRUZ · {new Date().toLocaleTimeString('es-MX', {hour:'2-digit',minute:'2-digit'})}</text>
          </g>
        </svg>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 12, left: 16, display: 'flex', gap: 18,
          fontFamily: 'var(--cruz-font-mono)', fontSize: 'var(--cruz-fs-micro)', letterSpacing: '0.15em',
          color: 'var(--cruz-fg-4)',
        }}>
          <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: 'var(--cruz-green-2)', marginRight: 6, verticalAlign: 'middle' }}/>FLUIDO</span>
          <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: 'var(--cruz-amber)', marginRight: 6, verticalAlign: 'middle' }}/>MODERADO</span>
          <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: 'var(--cruz-red)', marginRight: 6, verticalAlign: 'middle' }}/>CONGESTIONADO</span>
        </div>
      </div>

      {/* Bridge strip below */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
        borderTop: '1px solid var(--cruz-line-1)',
      }}>
        {bridges.map((b, i) => (
          <div key={b.id} style={{
            padding: '12px 14px',
            borderLeft: i === 0 ? 'none' : '1px solid var(--cruz-line-1)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 'var(--cruz-fs-xs)', color: 'var(--cruz-fg-2)' }}>{b.name}</span>
              <span className="cruz-num" style={{
                fontFamily: 'var(--cruz-font-mono)', fontSize: 'var(--cruz-fs-sm)', fontWeight: 500,
                color: b.st === 'warn' ? 'var(--cruz-amber)' : 'var(--cruz-green-2)',
              }}>{b.wait}<span style={{ color: 'var(--cruz-fg-5)', fontSize: 'var(--cruz-fs-micro)' }}>m</span></span>
            </div>
            <div className="cruz-meta" style={{ marginTop: 4 }}>{b.count} cruce{b.count !== 1 ? 's' : ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* =========================================================================
   Anexo24Table — dense SKU view (the data density you asked for)
   ========================================================================= */
const Anexo24Table = () => {
  const rows = [
    { sku: 'EV-PET-500',   frac: '3923.30.01', desc: 'Botella PET 500ml clear',       stock: 12480, cons: -842,  vmax: '36,000 USD', st: 'ok' },
    { sku: 'EV-PET-1000',  frac: '3923.30.01', desc: 'Botella PET 1L azul',            stock:  8240, cons: -1120, vmax: '29,400 USD', st: 'ok' },
    { sku: 'EV-CAP-28',    frac: '3923.50.01', desc: 'Tapa rosca 28mm HDPE',           stock: 48210, cons: -3100, vmax: '18,200 USD', st: 'ok' },
    { sku: 'EV-LBL-ROL-A', frac: '4821.10.01', desc: 'Rollo etiqueta adhesiva 80mm',   stock:   312, cons: -18,   vmax: '4,120 USD',  st: 'warn', note: 'stock bajo' },
    { sku: 'EV-MLD-16C',   frac: '8480.71.02', desc: 'Molde PET 16 cavidades',         stock:     4, cons:  0,    vmax: '148,000 USD', st: 'ok', note: 'A1 definitivo' },
    { sku: 'EV-PLT-EUR',   frac: '4415.20.02', desc: 'Tarima EUR 1200×800',            stock:   640, cons: -22,   vmax: '6,400 USD',  st: 'ok' },
    { sku: 'EV-STR-BL16',  frac: '3920.20.01', desc: 'Film stretch 16µ 500m',          stock:  1840, cons: -96,   vmax: '3,920 USD',  st: 'ok' },
    { sku: 'EV-INK-PET-R', frac: '3215.19.01', desc: 'Tinta PET roja litro',           stock:    48, cons: -4,    vmax: '1,180 USD',  st: 'warn', note: '3 lotes' },
    { sku: 'EV-CRT-GR-X',  frac: '4819.10.01', desc: 'Caja cartón corrugado X-large',  stock:  2210, cons: -140,  vmax: '2,420 USD',  st: 'ok' },
  ];
  return (
    <div className="cruz-card" style={{ overflow: 'hidden' }}>
      <div style={{
        padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid var(--cruz-line-1)',
      }}>
        <div>
          <span className="cruz-eyebrow">ANEXO 24 · SKUs EN TU PADRÓN</span>
          <div style={{ marginTop: 6, display: 'flex', gap: 14, alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--cruz-font-sans)', fontWeight: 500, fontSize: 28, color: 'var(--cruz-fg-1)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>245</span>
            <span className="cruz-meta">SKUs activos</span>
            <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--cruz-fg-5)' }}/>
            <span className="cruz-meta" style={{ color: 'var(--cruz-amber)' }}>3 por revisar</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="cruz-btn cruz-btn--ghost cruz-btn--sm"><Icon name="filter" size={12}/> Filtrar</button>
          <button className="cruz-btn cruz-btn--ghost cruz-btn--sm"><Icon name="download" size={12}/> Exportar CSV</button>
          <button className="cruz-btn cruz-btn--primary cruz-btn--sm">+ Alta SKU</button>
        </div>
      </div>
      <div style={{ maxHeight: 340, overflow: 'auto' }}>
        <table className="cruz-table" style={{ fontSize: 'var(--cruz-fs-xs)' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--cruz-ink-1)', zIndex: 1 }}>
            <tr>
              <th style={{ width: 32 }}></th>
              <th>SKU</th>
              <th>Fracción</th>
              <th>Descripción</th>
              <th style={{ textAlign: 'right' }}>Stock</th>
              <th style={{ textAlign: 'right' }}>Consumo 30d</th>
              <th style={{ textAlign: 'right' }}>V. máx</th>
              <th style={{ width: 24 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ cursor: 'pointer' }}>
                <td>
                  <span style={{
                    display: 'inline-block', width: 6, height: 6, borderRadius: 999,
                    background: r.st === 'warn' ? 'var(--cruz-amber)' : 'var(--cruz-green-2)',
                    boxShadow: r.st === 'warn' ? 'none' : '0 0 6px var(--cruz-green-glow)',
                  }}/>
                </td>
                <td className="num" style={{ color: 'var(--cruz-fg-1)' }}>{r.sku}</td>
                <td className="num">{r.frac}</td>
                <td>
                  {r.desc}
                  {r.note && <span style={{ marginLeft: 8, color: r.st === 'warn' ? 'var(--cruz-amber)' : 'var(--cruz-fg-4)', fontFamily: 'var(--cruz-font-mono)', fontSize: 'var(--cruz-fs-micro)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>· {r.note}</span>}
                </td>
                <td className="num" style={{ textAlign: 'right' }}>{r.stock.toLocaleString()}</td>
                <td className="num" style={{ textAlign: 'right', color: r.cons < 0 ? 'var(--cruz-fg-2)' : 'var(--cruz-fg-4)' }}>
                  {r.cons < 0 ? '−' : ''}{Math.abs(r.cons).toLocaleString()}
                </td>
                <td className="num" style={{ textAlign: 'right' }}>{r.vmax}</td>
                <td><Icon name="chevron" size={11} style={{ color: 'var(--cruz-fg-5)' }}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* =========================================================================
   OnboardingTour — first-visit spotlight
   ========================================================================= */
const OnboardingTour = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: 'Bienvenido a CRUZ.',
      body: 'Tu ventana en vivo a la operación aduanal. 80+ años de experiencia Zapata, reimaginados.',
      k: 'PASO 01 DE 04',
    },
    {
      title: 'Todo empieza con un cruce.',
      body: 'El mapa te muestra tus embarques en tiempo real, tiempos de espera en cada puente, y dónde está cada trailer ahora mismo.',
      k: 'PASO 02 DE 04',
    },
    {
      title: 'Seis módulos, una operación.',
      body: 'Embarques, pedimentos, expedientes, catálogo, entradas, Anexo 24. Cada tarjeta es un atajo al detalle completo.',
      k: 'PASO 03 DE 04',
    },
    {
      title: 'Pregúntale a CRUZ.',
      body: 'Presiona ⌘K en cualquier momento. CRUZ sabe tu patente, tus SKUs y tu historial. "¿Cuánto IVA pagué en marzo?" — listo.',
      k: 'PASO 04 DE 04',
    },
  ];
  const s = steps[step];
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(3,3,4,0.82)', backdropFilter: 'blur(6px)',
      zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 300ms var(--cruz-ease-out)',
    }}>
      <div style={{
        width: 'min(520px, 92vw)',
        background: 'var(--cruz-ink-2)', border: '1px solid var(--cruz-line-3)',
        borderRadius: 'var(--cruz-r-4)', boxShadow: 'var(--cruz-shadow-3)',
        padding: 32, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'var(--cruz-line-1)',
        }}>
          <div style={{
            height: '100%', width: `${((step + 1) / steps.length) * 100}%`,
            background: 'var(--cruz-green-2)', boxShadow: '0 0 12px var(--cruz-green-glow)',
            transition: 'width 400ms var(--cruz-ease-out)',
          }}/>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <span className="cruz-eyebrow">{s.k}</span>
          <button onClick={onClose} className="cruz-meta" style={{ color: 'var(--cruz-fg-4)' }}>Omitir</button>
        </div>

        <h2 style={{
          margin: 0, fontFamily: 'var(--cruz-font-display)', fontWeight: 300,
          fontSize: 36, lineHeight: 1.05, letterSpacing: '-0.025em', color: 'var(--cruz-fg-1)',
        }}>{s.title}</h2>
        <p style={{ marginTop: 14, fontSize: 'var(--cruz-fs-md)', color: 'var(--cruz-fg-3)', lineHeight: 1.55 }}>
          {s.body}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 36 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {steps.map((_, i) => (
              <span key={i} style={{
                width: i === step ? 24 : 6, height: 6, borderRadius: 999,
                background: i === step ? 'var(--cruz-green-2)' : 'var(--cruz-ink-5)',
                transition: 'all 300ms var(--cruz-ease-out)',
              }}/>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {step > 0 && (
              <button className="cruz-btn cruz-btn--ghost" onClick={() => setStep(step - 1)}>
                <Icon name="arrowLeft" size={13}/> Atrás
              </button>
            )}
            <button className="cruz-btn cruz-btn--primary" onClick={() => step === steps.length - 1 ? onClose() : setStep(step + 1)}>
              {step === steps.length - 1 ? 'Empezar' : 'Siguiente'} <Icon name="arrow" size={13}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { CrucesMap, Anexo24Table, OnboardingTour });
