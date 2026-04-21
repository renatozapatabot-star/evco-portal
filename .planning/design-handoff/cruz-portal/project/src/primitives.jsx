/* CRUZ — shared primitive components (React, JSX)
   Exposes globals for other files via window. */

const { useState, useEffect, useRef, useMemo } = React;

/* =========================================================================
   Iconography — monoline, 16/20/24 rem. Hand-crafted, no dependencies.
   ========================================================================= */
const Icon = ({ name, size = 16, stroke = 1.4, ...rest }) => {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', ...rest };
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></>,
    arrowLeft: <><path d="M19 12H5"/><path d="m11 19-7-7 7-7"/></>,
    home: <><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></>,
    logout: <><path d="M15 3h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></>,
    box: <><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/></>,
    doc: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/></>,
    folder: <><path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></>,
    catalog: <><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 3v18"/><path d="M12 7h5"/><path d="M12 11h5"/></>,
    truck: <><path d="M3 7h11v8H3z"/><path d="M14 10h4l3 3v2h-7z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></>,
    layer: <><path d="M12 3 2 8l10 5 10-5z"/><path d="m2 13 10 5 10-5"/><path d="m2 18 10 5 10-5"/></>,
    cmd: <><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M9 4v4H5"/><path d="M15 4v4h4"/><path d="M9 20v-4H5"/><path d="M15 20v-4h4"/></>,
    sparkle: <><path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m5.6 5.6 2.8 2.8"/><path d="m15.6 15.6 2.8 2.8"/><path d="m18.4 5.6-2.8 2.8"/><path d="m8.4 15.6-2.8 2.8"/></>,
    chevron: <><path d="m9 6 6 6-6 6"/></>,
    chevronDown: <><path d="m6 9 6 6 6-6"/></>,
    dot: <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>,
    filter: <><path d="M3 5h18"/><path d="M6 12h12"/><path d="M10 19h4"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    shield: <><path d="M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6z"/></>,
    bridge: <><path d="M2 10h20"/><path d="M2 10v8"/><path d="M22 10v8"/><path d="M7 10V7"/><path d="M12 10V5"/><path d="M17 10V7"/><path d="M2 18h20"/></>,
    copy: <><rect x="9" y="9" width="12" height="12" rx="1"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></>,
    check: <path d="M4 12l5 5 11-11"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    alert: <><path d="M12 2 1 21h22z"/><path d="M12 9v5"/><path d="M12 17h.01"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></>,
    minus: <path d="M5 12h14"/>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
};

/* =========================================================================
   Sparkline — deterministic, breathes subtly.
   ========================================================================= */
const Sparkline = ({ data, accent, height = 40, animate = true, id, dot = true }) => {
  const gradId = id || `g${Math.random().toString(36).slice(2, 8)}`;
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!animate) return;
    let raf;
    const tick = (t) => { setPhase(t / 2200); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  const w = 300;
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data.map((v, i) => {
    const breathe = animate ? Math.sin(phase + i * 0.4) * 0.5 : 0;
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 6) - 3 + breathe;
    return [x, y];
  });
  const path = points.reduce((s, [x, y], i) => s + (i === 0 ? `M${x},${y}` : ` L${x},${y}`), '');
  const fill = path + ` L${w},${h} L0,${h} Z`;
  const strokeColor = accent ? 'var(--cruz-green-2)' : 'var(--cruz-fg-3)';
  const glow = accent ? 'drop-shadow(0 0 6px var(--cruz-green-glow))' : 'none';
  const [lastX, lastY] = points[points.length - 1];
  // pulse amp
  const pulseR = 2.2 + (animate ? (Math.sin(phase * 2) + 1) * 1.1 : 0);
  const ringR = 3 + (animate ? ((phase * 1.5) % 1) * 8 : 0);
  const ringOpacity = animate ? 1 - ((phase * 1.5) % 1) : 0.6;

  return (
    <svg className="cruz-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ filter: glow, overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent ? 'var(--cruz-green-2)' : 'var(--cruz-fg-3)'} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={accent ? 'var(--cruz-green-2)' : 'var(--cruz-fg-3)'} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gradId})`}/>
      <path d={path} fill="none" stroke={strokeColor} strokeWidth="1.25" vectorEffect="non-scaling-stroke"/>
      {dot && (
        <g>
          <circle cx={lastX} cy={lastY} r={ringR} fill="none" stroke={strokeColor} strokeWidth="0.8" opacity={ringOpacity} vectorEffect="non-scaling-stroke"/>
          <circle cx={lastX} cy={lastY} r={pulseR} fill={strokeColor}/>
        </g>
      )}
    </svg>
  );
};

/* =========================================================================
   Ticker — FX, bridges, shipments streaming strip
   ========================================================================= */
const Ticker = () => {
  const items = [
    { k: 'USD/MXN', v: '17.2725', dir: 'up', d: '+0.0184' },
    { k: 'CAD/MXN', v: '12.4812', dir: 'down', d: '−0.0092' },
    { k: 'EUR/USD', v: '1.0874', dir: 'up', d: '+0.0021' },
    { k: 'PUENTE NUEVO LAREDO II', v: 'FLUIDO', dir: 'up', d: '8m' },
    { k: 'PUENTE COLOMBIA', v: 'FLUIDO', dir: 'up', d: '12m' },
    { k: 'PUENTE WORLD TRADE', v: 'MODERADO', dir: 'down', d: '34m' },
    { k: 'CRUCES HOY', v: '214', dir: 'up', d: '+11%' },
    { k: 'PEDIMENTOS ABR', v: '1,248', dir: 'up' },
    { k: 'ANEXO 24 ACTIVOS', v: '48,912' },
    { k: 'SAT · LATENCIA', v: '142ms', dir: 'up' },
    { k: 'VUCEM', v: 'OPERATIVO', dir: 'up' },
    { k: 'IMMEX · RZ3596', v: 'VIGENTE' },
  ];
  const row = (
    <>
      {items.map((it, i) => (
        <span className="cruz-ticker__item" key={i}>
          <span className="tk-label">{it.k}</span>
          <span className={it.dir === 'up' ? 'tk-up' : it.dir === 'down' ? 'tk-down' : ''}>{it.v}</span>
          {it.d && <span style={{ color: 'var(--cruz-fg-5)' }}>{it.d}</span>}
          <span style={{ color: 'var(--cruz-fg-5)' }}>·</span>
        </span>
      ))}
    </>
  );
  return (
    <div className="cruz-ticker">
      <div className="cruz-ticker__track">{row}{row}</div>
    </div>
  );
};

/* =========================================================================
   Badge / Pulse / Eyebrow
   ========================================================================= */
const Badge = ({ children, variant = 'default', dot }) => (
  <span className={`cruz-badge ${variant !== 'default' ? `cruz-badge--${variant}` : ''}`}>
    {dot && <span className="cruz-pulse" style={{ width: 5, height: 5 }}/>}
    {children}
  </span>
);

const Eyebrow = ({ children, style }) => <span className="cruz-eyebrow" style={style}>{children}</span>;

/* =========================================================================
   Globe — SVG wireframe, self-rotating. Drops cleanly onto dark UI.
   ========================================================================= */
const Globe = ({ size = 22, speed = 22, accent = true, style }) => {
  // wireframe: outer circle + 5 longitudes (as ellipses rotated via SVG) + 3 latitudes (static ellipses)
  // rotation is achieved by phase shifting the longitudes' rx via sin — looks like rotation.
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase(((t - t0) / 1000) * (2 * Math.PI / speed)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  const r = 10;
  const stroke = accent ? 'var(--cruz-green-2)' : 'var(--cruz-fg-3)';
  const dimStroke = accent ? 'color-mix(in oklch, var(--cruz-green-2) 45%, transparent)' : 'var(--cruz-fg-4)';

  // longitudes: 5 meridians offset by 2π/5; each appears as ellipse whose rx = r * |cos(phase + offset)|
  const meridians = [0, 1, 2, 3, 4].map(i => {
    const off = (i * Math.PI) / 5;
    const rx = Math.abs(Math.cos(phase + off)) * r;
    const back = Math.sin(phase + off) > 0; // for opacity
    return { rx, back, key: i };
  });

  return (
    <svg width={size} height={size} viewBox="-12 -12 24 24" style={{ display: 'block', ...style }}>
      {/* glow halo */}
      {accent && <circle cx="0" cy="0" r={r + 0.5} fill="none" stroke={stroke} strokeWidth="0.4" opacity="0.25" filter="drop-shadow(0 0 3px var(--cruz-green-glow))"/>}
      {/* outer sphere */}
      <circle cx="0" cy="0" r={r} fill="none" stroke={stroke} strokeWidth="0.8"/>
      {/* latitudes (static) */}
      {[-6, -3, 0, 3, 6].map((y, i) => {
        const rx = Math.sqrt(Math.max(0, r * r - y * y));
        return <ellipse key={i} cx="0" cy={y} rx={rx} ry={rx * 0.18} fill="none" stroke={dimStroke} strokeWidth="0.35"/>;
      })}
      {/* rotating longitudes */}
      {meridians.map(m => (
        <ellipse key={m.key} cx="0" cy="0" rx={m.rx} ry={r} fill="none"
          stroke={stroke} strokeWidth={m.back ? 0.6 : 0.3}
          opacity={m.back ? 0.9 : 0.35}/>
      ))}
      {/* equator accent */}
      <line x1={-r} y1="0" x2={r} y2="0" stroke={stroke} strokeWidth="0.5" opacity="0.5"/>
    </svg>
  );
};

/* =========================================================================
   WorldMesh — subtle animated lat/long background, used on all pages.
   ========================================================================= */
const WorldMesh = ({ opacity = 0.06, animate = true }) => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!animate) return;
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase((t - t0) / 18000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  const longs = 24;
  const lats = 12;
  return (
    <div aria-hidden="true" style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
      maskImage: 'radial-gradient(ellipse at 50% 40%, black 20%, transparent 75%)',
      WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, black 20%, transparent 75%)',
      opacity,
    }}>
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="wm-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cruz-green-2)" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="var(--cruz-green-2)" stopOpacity="0.15"/>
          </linearGradient>
        </defs>
        {/* latitudes */}
        {Array.from({ length: lats }).map((_, i) => {
          const y = (i / (lats - 1)) * 1080;
          const ry = 30 + Math.sin(phase * 2 * Math.PI + i * 0.5) * 6;
          return <ellipse key={'lat' + i} cx="960" cy={y} rx="1200" ry={ry} fill="none" stroke="url(#wm-grad)" strokeWidth="0.5"/>;
        })}
        {/* longitudes (sine-wave style) */}
        {Array.from({ length: longs }).map((_, i) => {
          const offset = (i / longs) * 1920;
          const phaseShift = phase * 2 * Math.PI + i * 0.3;
          const pts = Array.from({ length: 40 }).map((__, j) => {
            const t = j / 39;
            const y = t * 1080;
            const x = offset + Math.sin(t * Math.PI * 2 + phaseShift) * 20;
            return `${x},${y}`;
          }).join(' ');
          return <polyline key={'lng' + i} points={pts} fill="none" stroke="var(--cruz-green-2)" strokeOpacity="0.28" strokeWidth="0.4"/>;
        })}
      </svg>
    </div>
  );
};

/* =========================================================================
   Logo — CRUZ wordmark (with optional globe)
   ========================================================================= */
const CruzMark = ({ size = 14, tracking = '0.8em', weight = 200, animate = false, globe = true, globeSize }) => {
  const [show, setShow] = useState(!animate);
  useEffect(() => { if (animate) { const t = setTimeout(() => setShow(true), 100); return () => clearTimeout(t); } }, [animate]);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.65, position: 'relative' }}>
      {globe && <Globe size={globeSize || Math.round(size * 1.5)} accent/>}
      <span style={{
        fontFamily: 'var(--cruz-font-display)',
        fontWeight: weight,
        fontSize: size,
        letterSpacing: tracking,
        color: 'var(--cruz-fg-1)',
        paddingLeft: globe ? 0 : '0.8em',
        display: 'inline-block',
      }}>
        {['C','R','U','Z'].map((l, i) => (
          <span key={i} style={{
            display: 'inline-block',
            opacity: show ? 1 : 0,
            transform: show ? 'translateY(0)' : 'translateY(6px)',
            transition: `opacity 500ms cubic-bezier(0.22,1,0.36,1) ${i * 120}ms, transform 500ms cubic-bezier(0.22,1,0.36,1) ${i * 120}ms`,
          }}>{l}</span>
        ))}
      </span>
    </div>
  );
};

Object.assign(window, { Icon, Sparkline, Ticker, Badge, Eyebrow, CruzMark, Globe, WorldMesh });
