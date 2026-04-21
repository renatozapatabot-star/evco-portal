/* PORTAL — Dashboard
   Warm greeting, module grid with varied visual treatments per card type,
   living Asistente CRUZ, world-mesh background. */

const TopBar = ({ onLogout, onOpenCmd }) => {
  const [pulse, setPulse] = useState(false);
  const [lastCross, setLastCross] = useState(null);
  useEffect(() => {
    if (!window.__cruzCrossingBus) return;
    const off = window.__cruzCrossingBus.on((evt) => {
      setLastCross(evt);
      setPulse(true);
      const orig = document.title;
      document.title = `✓ ${evt.label} cruzó · ${orig.replace(/^✓[^·]*·\s*/, '')}`;
      setTimeout(() => setPulse(false), 1100);
      setTimeout(() => { document.title = orig; }, 3000);
    });
    return off;
  }, []);
  return (
    <header style={{
      height: 'var(--cruz-topbar-h)',
      display: 'grid', gridTemplateColumns: 'auto 1fr auto',
      gap: 12,
      alignItems: 'center', padding: '0 clamp(12px, 3vw, 24px)',
      borderBottom: '1px solid ' + (pulse ? 'var(--cruz-green-2)' : 'var(--cruz-line-1)'),
      background: pulse
        ? 'color-mix(in oklch, var(--cruz-green-2) 6%, var(--cruz-ink-0) 85%)'
        : 'color-mix(in oklch, var(--cruz-ink-0) 85%, transparent)',
      backdropFilter: 'blur(12px)',
      position: 'sticky', top: 0, zIndex: 20,
      transition: 'all 700ms var(--cruz-ease-out)',
      boxShadow: pulse ? '0 0 30px -4px var(--cruz-green-glow)' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ position: 'relative', width: 9, height: 9, flexShrink: 0 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--cruz-green-2)', boxShadow: '0 0 12px var(--cruz-green-glow)', animation: 'portalDotPulse 2.4s ease-in-out infinite' }}/>
          <span style={{ position: 'absolute', inset: -4, borderRadius: 999, border: '1px solid var(--cruz-green-2)', opacity: 0.5, animation: 'portalPing 2.4s ease-out infinite' }}/>
          <span style={{ position: 'absolute', inset: -4, borderRadius: 999, border: '1px solid var(--cruz-green-2)', opacity: 0.3, animation: 'portalPing 2.4s ease-out 1.2s infinite' }}/>
        </span>
        <span style={{
          fontFamily: 'var(--cruz-font-display)', fontWeight: 300, fontSize: 15,
          letterSpacing: '0.45em', color: 'var(--cruz-fg-1)', paddingLeft: '0.3em',
        }}>PORTAL</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}>
        <button onClick={onOpenCmd} style={{
          width: '100%', maxWidth: 560, height: 36, padding: '0 12px',
          borderRadius: 'var(--cruz-r-2)', border: '1px solid var(--cruz-line-1)',
          background: 'var(--cruz-ink-2)', display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 'var(--cruz-fs-sm)', color: 'var(--cruz-fg-3)', minWidth: 0,
        }}>
          <Icon name="search" size={14}/>
          <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Busca un SKU, pedimento, embarque, Anexo 24…</span>
          <span className="cruz-kbd">⌘</span><span className="cruz-kbd">K</span>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
        {lastCross && (
          <span key={lastCross.id} style={{
            fontFamily: 'var(--cruz-font-mono)', fontSize: 10, letterSpacing: '0.16em',
            color: pulse ? 'var(--cruz-green-2)' : 'var(--cruz-fg-4)',
            textTransform: 'uppercase',
            animation: pulse ? 'crossToastIn 400ms var(--cruz-ease-out) both' : 'none',
            transition: 'color 700ms',
            whiteSpace: 'nowrap',
          }}>
            ✓ {lastCross.label} · {lastCross.ts}
          </span>
        )}
        <Badge variant="live" dot>EN LÍNEA</Badge>
        <button className="cruz-btn cruz-btn--ghost cruz-btn--sm" onClick={onLogout}>
          <Icon name="logout" size={13}/> Salir
        </button>
      </div>
    </header>
  );
};

/* —— Greeting ——————————————————————————————— */
const Greeting = ({ name = 'Renato' }) => {
  const d = new Date();
  const h = d.getHours();
  const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  const fecha = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <section style={{ paddingTop: 'var(--cruz-s-8)', paddingBottom: 'var(--cruz-s-6)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{
          margin: 0,
          fontFamily: 'var(--cruz-font-display)',
          fontWeight: 300,
          fontSize: 'clamp(32px, 4.2vw, 52px)',
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
          color: 'var(--cruz-fg-1)',
        }}>
          {saludo}, <span style={{ color: 'var(--cruz-green-2)' }}>{name}</span>.
        </h1>
        <span className="cruz-meta" style={{ color: 'var(--cruz-fg-4)', textTransform: 'capitalize' }}>
          {fecha}
        </span>
      </div>
      <p style={{
        margin: '10px 0 0',
        fontSize: 'var(--cruz-fs-md)',
        color: 'var(--cruz-fg-3)',
        maxWidth: 620,
      }}>
        Tu operación está en calma. <span className="cruz-num" style={{ color: 'var(--cruz-fg-1)' }}>2</span> embarques en tránsito, <span className="cruz-num" style={{ color: 'var(--cruz-fg-1)' }}>3</span> pedimentos hoy, y todo firmado.
      </p>
    </section>
  );
};

/* —— Per-card visual primitives (each module gets its own signature) —————————— */
const VizSpark = ({ data }) => <Sparkline data={data} accent height={44} dot/>;

const VizBars = ({ data, max }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 44 }}>
    {data.map((v, i) => (
      <div key={i} style={{
        flex: 1,
        height: `${(v / max) * 100}%`,
        minHeight: 2,
        background: i === data.length - 1 ? 'var(--cruz-green-2)' : 'color-mix(in oklch, var(--cruz-green-2) 45%, transparent)',
        borderRadius: 1,
        boxShadow: i === data.length - 1 ? '0 0 6px var(--cruz-green-glow)' : 'none',
        transition: 'all 300ms',
      }}/>
    ))}
  </div>
);

const VizRing = ({ pct }) => {
  const r = 18, c = 2 * Math.PI * r;
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase((t - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const glowOpacity = 0.5 + Math.sin(phase * 1.5) * 0.25;
  return (
    <svg width="44" height="44" viewBox="-22 -22 44 44" style={{ transform: 'rotate(-90deg)' }}>
      <circle r={r} fill="none" stroke="var(--cruz-line-2)" strokeWidth="2"/>
      <circle r={r} fill="none" stroke="var(--cruz-green-2)" strokeWidth="2"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 ${4 * glowOpacity}px var(--cruz-green-glow))`, transition: 'stroke-dashoffset 800ms' }}/>
    </svg>
  );
};

const VizStack = ({ layers }) => {
  // stacked horizontal bands — each layer is percent filled
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      {layers.map((l, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="cruz-meta" style={{ width: 52, color: 'var(--cruz-fg-5)', fontSize: 9 }}>{l.k}</span>
          <div style={{ flex: 1, height: 6, borderRadius: 2, background: 'var(--cruz-ink-3)', overflow: 'hidden' }}>
            <div style={{
              width: `${l.pct}%`, height: '100%',
              background: l.warn ? 'var(--cruz-amber)' : 'var(--cruz-green-2)',
              boxShadow: l.warn ? 'none' : '0 0 6px var(--cruz-green-glow)',
              transition: 'width 500ms',
            }}/>
          </div>
          <span className="cruz-num" style={{ fontSize: 10, color: 'var(--cruz-fg-2)', minWidth: 30, textAlign: 'right' }}>{l.v}</span>
        </div>
      ))}
    </div>
  );
};

const VizPulse = ({ items }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {items.map((it, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--cruz-fg-2)' }}>
        <span style={{
          width: 5, height: 5, borderRadius: 999,
          background: it.live ? 'var(--cruz-green-2)' : 'var(--cruz-fg-5)',
          boxShadow: it.live ? '0 0 6px var(--cruz-green-glow)' : 'none',
          animation: it.live ? 'cruzPulse 1.6s ease-in-out infinite' : 'none',
        }}/>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.t}</span>
        <span className="cruz-num" style={{ color: 'var(--cruz-fg-4)', fontSize: 10 }}>{it.v}</span>
      </div>
    ))}
  </div>
);

const VizEmpty = () => (
  <div style={{
    height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px dashed var(--cruz-line-2)', borderRadius: 'var(--cruz-r-2)',
    color: 'var(--cruz-fg-5)', fontSize: 10, letterSpacing: '0.18em',
  }}>PRÓXIMAMENTE</div>
);

/* Stacked doc pile — pages settling in, no amber */
const VizDocs = () => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase((t - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: 44 }}>
      <svg width="48" height="44" viewBox="0 0 48 44">
        {[0,1,2,3,4].map(i => {
          const shift = Math.sin(phase * 0.8 + i * 0.6) * 1.5;
          return (
            <rect key={i} x={4 + i * 2} y={6 + i * 5 + shift} width="32" height="26" rx="2"
              fill="var(--cruz-ink-3)" stroke="var(--cruz-green-2)" strokeOpacity={0.3 + i * 0.15} strokeWidth="0.8"/>
          );
        })}
        <path d="M10 14 L32 14 M10 18 L28 18 M10 22 L30 22" stroke="var(--cruz-green-2)" strokeWidth="0.8" opacity="0.9"/>
      </svg>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--cruz-fg-2)' }}>Firmas electrónicas</div>
        <div className="cruz-meta" style={{ color: 'var(--cruz-fg-5)', marginTop: 2 }}>412 OK · 24 PEND · 12 NUEVO</div>
      </div>
    </div>
  );
};

/* Catálogo preview — real UI mini-screen showing AI classification */
const VizCatalog = () => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase((t - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  // Simulate confidence bar filling to 98%
  const conf = Math.min(98, Math.floor(40 + (phase * 20) % 60));
  return (
    <div style={{
      height: 88,
      background: 'var(--cruz-ink-0)',
      border: '1px solid var(--cruz-line-1)',
      borderRadius: 'var(--cruz-r-2)',
      padding: '8px 10px',
      display: 'flex', flexDirection: 'column', gap: 6,
      fontFamily: 'var(--cruz-font-mono)',
      fontSize: 9,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* scan line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, var(--cruz-green-2), transparent)',
        opacity: 0.6,
        top: `${(phase * 40) % 100}%`,
        transition: 'top 100ms linear',
      }}/>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--cruz-fg-5)', letterSpacing: '0.12em' }}>
        <span>FRACCIÓN IA</span>
        <span style={{ color: 'var(--cruz-green-2)' }}>● ANALIZANDO</span>
      </div>
      <div style={{ color: 'var(--cruz-fg-1)', fontSize: 13, letterSpacing: '0.02em' }}>
        8471.30.01
      </div>
      <div style={{ color: 'var(--cruz-fg-4)', fontSize: 9, letterSpacing: '0.08em', lineHeight: 1.3 }}>
        Máquinas automáticas para procesamiento de datos portátiles
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
        <div style={{ flex: 1, height: 3, background: 'var(--cruz-ink-3)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${conf}%`,
            background: 'var(--cruz-green-2)',
            boxShadow: '0 0 8px var(--cruz-green-glow)',
            transition: 'width 300ms var(--cruz-ease-out)',
          }}/>
        </div>
        <span style={{ color: 'var(--cruz-green-2)', fontSize: 10 }}>{conf}%</span>
      </div>
    </div>
  );
};

/* —— VizPedimentoLedger ————————————————————————————————————————————
   For the Pedimentos card. A stack of document "rows" representing recent
   pedimentos, each with status chip + seal dot. Scrolls slowly upward.
   Not a bar chart. Not the same as VizDocs (which is a side doc pile for
   Expedientes). This is a compact tabular ledger — very "customs broker". */
const VizPedimentoLedger = () => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase((t - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const rows = [
    { id: '6002104', type: 'A1', st: 'OK' },
    { id: '6002103', type: 'A1', st: 'OK' },
    { id: '6002102', type: 'IN', st: 'LIVE' },
    { id: '6002101', type: 'A1', st: 'OK' },
    { id: '6002100', type: 'A3', st: 'OK' },
  ];
  return (
    <div style={{ position: 'relative', height: 44, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {rows.map((r, i) => {
          const live = r.st === 'LIVE';
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '10px 1fr auto auto', gap: 8, alignItems: 'center',
              fontFamily: 'var(--cruz-font-mono)', fontSize: 9,
              opacity: 1 - i * 0.14,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 999,
                background: live ? 'var(--cruz-green-2)' : 'color-mix(in oklch, var(--cruz-green-2) 50%, transparent)',
                boxShadow: live ? '0 0 6px var(--cruz-green-glow)' : 'none',
                animation: live ? 'cruzPulse 1.4s ease-in-out infinite' : 'none',
              }}/>
              <span style={{ color: 'var(--cruz-fg-2)', letterSpacing: '0.04em' }}>240-2601-{r.id}</span>
              <span style={{
                padding: '1px 4px', borderRadius: 2,
                border: '1px solid ' + (live ? 'var(--cruz-green-3)' : 'var(--cruz-line-2)'),
                color: live ? 'var(--cruz-green-2)' : 'var(--cruz-fg-4)',
                fontSize: 8, letterSpacing: '0.1em',
              }}>{r.type}</span>
              <span style={{ color: live ? 'var(--cruz-green-2)' : 'var(--cruz-fg-5)', fontSize: 8, letterSpacing: '0.12em' }}>
                {live ? 'EN FIRMA' : 'LIBERADO'}
              </span>
            </div>
          );
        })}
      </div>
      {/* fade-out mask at bottom */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 14,
        background: 'linear-gradient(to bottom, transparent, var(--cruz-ink-2))',
        pointerEvents: 'none',
      }}/>
    </div>
  );
};

/* —— VizWarehouseDock ————————————————————————————————————————————
   For the Entradas card. A top-down warehouse scene with 5 bay doors,
   and a truck slowly approaching the one "active" bay. Static containers
   line the other bays. Completely different visual vocabulary from the
   ledger above it. */
const VizWarehouseDock = () => {
  // Static, docked frame. No animation — the dashboard already has
  // enough movement; this card should read as a snapshot, not a stage.
  const truckX = 66; // truck fully docked
  const activeBay = 2;

  return (
    <svg width="100%" height="44" viewBox="0 0 100 44"
         preserveAspectRatio="xMidYMid meet"
         style={{ display: 'block' }}>
      {/* Ground/apron */}
      <rect x="0" y="28" width="100" height="16" fill="var(--cruz-ink-3)" opacity="0.6"/>
      {/* Lane markings — dashed */}
      {[0,1,2,3,4,5,6,7,8,9].map(i => (
        <rect key={i} x={i * 10 + 2} y="35" width="5" height="0.6"
              fill="var(--cruz-line-2)" opacity="0.5"/>
      ))}

      {/* Warehouse building — top portion */}
      <rect x="0" y="2" width="100" height="26"
            fill="color-mix(in oklch, var(--cruz-ink-3) 70%, var(--cruz-green-2))"
            opacity="0.22"/>
      <rect x="0" y="2" width="100" height="1" fill="var(--cruz-green-3)" opacity="0.6"/>

      {/* Bay doors — 5 */}
      {[0,1,2,3,4].map(i => {
        const bx = 8 + i * 18;
        const active = i === activeBay;
        return (
          <g key={i}>
            {/* Door frame */}
            <rect x={bx} y="6" width="14" height="22" rx="1"
                  fill="var(--cruz-ink-0)"
                  stroke={active ? 'var(--cruz-green-2)' : 'var(--cruz-line-2)'}
                  strokeWidth="0.6"
                  opacity={active ? 1 : 0.8}/>
            {/* Door horizontal slats */}
            {[0,1,2,3,4].map(j => (
              <line key={j} x1={bx + 1} y1={9 + j * 4} x2={bx + 13} y2={9 + j * 4}
                    stroke={active ? 'var(--cruz-green-3)' : 'var(--cruz-line-2)'}
                    strokeWidth="0.4" opacity={active ? 0.9 : 0.5}/>
            ))}
            {/* Bay number */}
            <text x={bx + 7} y="4.5" fontSize="2.6" fontFamily="monospace"
                  fill={active ? 'var(--cruz-green-2)' : 'var(--cruz-fg-5)'}
                  textAnchor="middle" letterSpacing="0.5">
              {String(i + 1).padStart(2, '0')}
            </text>
            {/* Active bay indicator light */}
            {active && (
              <circle cx={bx + 7} cy="29.5" r="0.8" fill="var(--cruz-green-2)"/>
            )}
            {/* Static container parked at non-active bays */}
            {!active && i % 2 === 0 && (
              <rect x={bx + 2} y="31" width="10" height="5" rx="0.5"
                    fill="color-mix(in oklch, var(--cruz-ink-3) 50%, var(--cruz-green-2))"
                    opacity="0.55"/>
            )}
          </g>
        );
      })}

      {/* Active bay — truck approaching */}
      <g transform={`translate(${8 + activeBay * 18 - truckX + 14} 0)`}>
        {/* trailer */}
        <rect x="-16" y="31" width="14" height="6" rx="0.5"
              fill="var(--cruz-green-2)"
              opacity="0.95"/>
        <rect x="-16" y="31" width="14" height="1.2" fill="var(--cruz-green-3)"/>
        {/* cab */}
        <rect x="-2" y="32" width="3.5" height="5" rx="0.5"
              fill="var(--cruz-fg-3)"/>
        {/* headlights — forward sweep */}
        <circle cx="1.6" cy="34.5" r="0.5" fill="var(--cruz-amber)" opacity="0.9"/>
      </g>

      {/* Subtle scanline across warehouse roof when active */}
      <line x1="0" y1="2.5" x2="100" y2="2.5" stroke="var(--cruz-green-2)" strokeWidth="0.2" opacity="0.4"/>
    </svg>
  );
};

/* —— Module card — single coherent design, varied viz inside ——————————— */
const ModuleCard = ({ icon, title, desc, metric, metricLabel, viz, badge, onClick, accent }) => (
  <button
    onClick={onClick}
    className="cruz-card cruz-card--interactive"
    style={{
      padding: 'var(--cruz-s-6)', textAlign: 'left', position: 'relative',
      display: 'flex', flexDirection: 'column', gap: 16, minHeight: 200,
      background: accent ? 'radial-gradient(ellipse at 0% 0%, color-mix(in oklch, var(--cruz-green-2) 8%, var(--cruz-ink-1)), var(--cruz-ink-1) 55%)' : 'var(--cruz-ink-1)',
    }}
  >
    {accent && <div className="cruz-card__rail" style={{ opacity: 1 }}/>}

    {/* Header: icon + title + badge */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 'var(--cruz-r-2)',
        background: 'var(--cruz-ink-3)', border: '1px solid var(--cruz-line-1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--cruz-fg-2)',
      }}>
        <Icon name={icon} size={15}/>
      </div>
      <div style={{
        fontFamily: 'var(--cruz-font-display)', fontWeight: 400, fontSize: 20,
        color: 'var(--cruz-fg-1)', letterSpacing: '-0.01em', flex: 1,
      }}>{title}</div>
      {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
    </div>

    {/* Description */}
    <div style={{ fontSize: 'var(--cruz-fs-sm)', color: 'var(--cruz-fg-3)', lineHeight: 1.45 }}>
      {desc}
    </div>

    {/* Visualization slot */}
    <div style={{ marginTop: 'auto' }}>{viz}</div>

    {/* Footer metric */}
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      paddingTop: 10, borderTop: '1px solid var(--cruz-line-1)',
    }}>
      <span className="cruz-meta" style={{ color: 'var(--cruz-fg-5)' }}>{metricLabel}</span>
      <span className="cruz-num" style={{
        fontSize: 22, fontWeight: 500, color: 'var(--cruz-fg-1)',
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
      }}>{metric}</span>
    </div>
  </button>
);

const ModulesGrid = ({ onOpenDetail }) => {
  const cards = [
    {
      icon: 'truck', title: 'Embarques',
      desc: '2 unidades en tránsito ahora mismo. 4 cruces programados esta semana.',
      accent: true, onClick: onOpenDetail,
      badge: { variant: 'live', label: '2 EN TRÁNSITO' },
      viz: <VizPulse items={[
        { t: 'TX-4829 · N. Laredo II', v: 'en ruta', live: true },
        { t: 'TX-4830 · Colombia', v: '12m', live: true },
        { t: 'TX-4828 · entregado', v: 'ayer', live: false },
      ]}/>,
      metric: '18', metricLabel: 'ACTIVOS',
    },
    {
      icon: 'doc', title: 'Pedimentos',
      desc: 'Declaraciones aduanales. 3 firmados hoy, todo al corriente.',
      badge: { variant: 'info', label: '3 HOY' },
      viz: <VizPedimentoLedger/>,
      metric: '10', metricLabel: 'ESTE MES',
      onClick: () => window.__cruzOpenTheater && window.__cruzOpenTheater('240-2601-6002104'),
      accent: true,
    },
    {
      icon: 'folder', title: 'Expedientes',
      desc: 'Carpetas de operación digitales. Firmas electrónicas al día.',
      viz: <VizDocs/>,
      metric: '448', metricLabel: 'ESTE MES',
    },
    {
      icon: 'catalog', title: 'Catálogo',
      desc: 'Partes, fracciones arancelarias e historial de clasificación IA.',
      badge: { variant: 'default', label: 'PREVIEW' },
      viz: <VizCatalog/>,
      metric: 'Q2', metricLabel: 'PRÓXIMAMENTE',
    },
    {
      icon: 'box', title: 'Entradas',
      desc: 'Recibos en almacén Laredo TX. 26 entradas esta semana.',
      viz: <VizWarehouseDock/>,
      metric: '26', metricLabel: 'ESTA SEMANA',
    },
    {
      icon: 'layer', title: 'Anexo 24',
      desc: 'Padrón de SKUs con IMMEX vigente. 3 requieren revisión de clasificación.',
      badge: { variant: 'warn', label: '3 POR REVISAR' },
      viz: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <VizRing pct={98}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--cruz-fg-2)' }}>Clasificación al día</div>
            <div className="cruz-meta" style={{ color: 'var(--cruz-fg-5)', marginTop: 2 }}>242 DE 245 · <span className="cruz-num">98.8%</span></div>
          </div>
        </div>
      ),
      metric: '245', metricLabel: 'SKUs EN ANEXO',
    },
  ];
  return (
    <div className="cruz-modules-grid">
      {cards.map((c, i) => <ModuleCard key={i} {...c}/>)}
    </div>
  );
};

/* —— Living Asistente CRUZ FAB —————————————————————————— */
const AssistantFab = ({ onClick }) => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase((t - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const breathe = 1 + Math.sin(phase * 1.6) * 0.06;
  const ringR = 14 + ((phase * 1.2) % 1) * 12;
  const ringO = 1 - ((phase * 1.2) % 1);
  return (
    <button onClick={onClick} className="cruz-fab" style={{
      position: 'fixed', right: 24, bottom: 24, zIndex: 40,
      padding: '12px 18px 12px 14px', borderRadius: 'var(--cruz-r-pill)',
      background: 'var(--cruz-ink-3)',
      border: '1px solid color-mix(in oklch, var(--cruz-green-2) 30%, var(--cruz-line-3))',
      boxShadow: 'var(--cruz-shadow-3), 0 0 0 4px color-mix(in oklch, var(--cruz-green-2) 8%, transparent), 0 0 32px color-mix(in oklch, var(--cruz-green-2) 15%, transparent)',
      display: 'flex', alignItems: 'center', gap: 12,
      color: 'var(--cruz-fg-1)', fontSize: 'var(--cruz-fs-sm)',
    }}>
      <span style={{ position: 'relative', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* expanding ring */}
        <span style={{
          position: 'absolute', width: ringR * 2, height: ringR * 2, borderRadius: 999,
          border: '1px solid var(--cruz-green-2)', opacity: ringO * 0.6,
          transform: `translate(-50%,-50%)`, left: '50%', top: '50%',
        }}/>
        {/* breathing core */}
        <span style={{
          width: 8, height: 8, borderRadius: 999,
          background: 'var(--cruz-green-2)',
          boxShadow: '0 0 12px var(--cruz-green-glow), 0 0 24px var(--cruz-green-glow)',
          transform: `scale(${breathe})`,
        }}/>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
        <span className="cruz-meta" style={{ color: 'var(--cruz-fg-5)', fontSize: 9, marginBottom: 1 }}>EN LÍNEA · CONTEXTO 90D</span>
        <span style={{ fontFamily: 'var(--cruz-font-sans)', fontWeight: 500 }}>Agente IA</span>
      </span>
      <span className="cruz-kbd">⌘K</span>
    </button>
  );
};

/* Command palette */
const AsistenteCruz = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 120,
      animation: 'fadeIn 200ms var(--cruz-ease-out)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(620px, 92vw)', background: 'var(--cruz-ink-2)',
        border: '1px solid var(--cruz-line-3)', borderRadius: 'var(--cruz-r-4)',
        boxShadow: 'var(--cruz-shadow-3)', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--cruz-line-1)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--cruz-green-2)', boxShadow: '0 0 8px var(--cruz-green-glow)', animation: 'cruzPulse 1.6s ease-in-out infinite' }}/>
          <input autoFocus placeholder="Pregúntale al Agente IA — '¿cuánto IVA pagué en marzo?'" style={{
            flex: 1, background: 'transparent', border: 0, outline: 'none',
            fontSize: 'var(--cruz-fs-md)', color: 'var(--cruz-fg-1)', fontFamily: 'var(--cruz-font-sans)',
          }}/>
          <Badge>ESC</Badge>
        </div>
        <div style={{ padding: 14 }}>
          <div className="cruz-eyebrow" style={{ padding: '4px 8px 10px' }}>SUGERENCIAS</div>
          {[
            { i: 'truck', t: 'Ver embarques en tránsito' },
            { i: 'doc', t: 'Mostrar pedimento 240-2601-6002104' },
            { i: 'layer', t: 'SKUs en Anexo 24 por revisar' },
            { i: 'bridge', t: 'Estado de puentes ahora' },
          ].map((s, i) => (
            <button key={i} style={{
              width: '100%', padding: '10px 8px', borderRadius: 'var(--cruz-r-2)',
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
              color: 'var(--cruz-fg-2)', fontSize: 'var(--cruz-fs-sm)',
            }} onMouseEnter={e => e.currentTarget.style.background = 'var(--cruz-ink-3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Icon name={s.i} size={14} style={{ color: 'var(--cruz-fg-4)' }}/>
              <span style={{ flex: 1 }}>{s.t}</span>
              <Icon name="chevron" size={12} style={{ color: 'var(--cruz-fg-5)' }}/>
            </button>
          ))}
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  );
};

const DashboardScreen = ({ onLogout, onOpenDetail }) => {
  const [cmdOpen, setCmdOpen] = useState(false);
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdOpen(true); }
      if (e.key === 'Escape') setCmdOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cruz-ink-0)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <WorldMesh opacity={0.04}/>
      <TopBar onLogout={onLogout} onOpenCmd={() => setCmdOpen(true)}/>
      <main style={{
        padding: '0 clamp(16px, 4vw, 32px) var(--cruz-s-11)',
        maxWidth: 'var(--cruz-maxw)', margin: '0 auto', width: '100%',
        position: 'relative', zIndex: 1,
      }}>
        <Greeting name="Renato"/>
        <ModulesGrid onOpenDetail={onOpenDetail}/>
      </main>
      <AssistantFab onClick={() => setCmdOpen(true)}/>
      <AsistenteCruz open={cmdOpen} onClose={() => setCmdOpen(false)}/>
    </div>
  );
};

Object.assign(window, { DashboardScreen });
