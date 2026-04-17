/* PORTAL — Ambient login.
   Entire screen is a living, breathing portrait of the border. The access
   screen is a single quiet centered element. No command-center chrome, no
   welcome copy, no side card. Just life around a simple code entry.
*/

/* ---------------- Living Background ---------------- */
/* A slow, beautiful top-down cartographic scene of the Laredo corridor.
   Drifting atmospheric layers + subtle trucks crossing bridges + a gentle
   pulse of cleared pedimentos. Not a dashboard. A quiet, alive picture. */
const LivingBackground = () => {
  const [phase, setPhase] = useState(0);
  const [pings, setPings] = useState([]);
  const pingIdRef = useRef(0);

  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase((t - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Occasional pedimento-cleared pings bloom at bridge inspection points
  useEffect(() => {
    const bridgePoints = [
      { x: 48, y: 34 }, { x: 50, y: 46 }, { x: 52, y: 60 }, { x: 51, y: 72 },
    ];
    const spawn = () => {
      const p = bridgePoints[Math.floor(Math.random() * bridgePoints.length)];
      const id = ++pingIdRef.current;
      setPings(prev => [...prev, { id, x: p.x + (Math.random() - 0.5) * 2, y: p.y + (Math.random() - 0.5) * 1.2, born: performance.now() }]);
      setTimeout(() => setPings(prev => prev.filter(p => p.id !== id)), 4000);
    };
    const i = setInterval(spawn, 2400);
    spawn();
    return () => clearInterval(i);
  }, []);

  const bridges = [
    { y: 34, speed: 22, offset: 0 },
    { y: 46, speed: 18, offset: 5 },
    { y: 60, speed: 26, offset: 2 },
    { y: 72, speed: 30, offset: 8 },
  ];

  const truckOf = (bridge, dir, lane) => {
    const period = bridge.speed;
    const start = (phase + bridge.offset + lane * (period / 3)) / period;
    const t = (start % 1);
    const x = dir === 'N' ? 35 + t * 30 : 65 - t * 30;
    return { x, y: bridge.y + (dir === 'N' ? -0.35 : 0.35), dir };
  };

  // Slow drifting cloud offsets (parallax layers)
  const c1x = -50 + ((phase / 180) % 1) * 200;
  const c2x = -80 + ((phase / 240 + 0.4) % 1) * 220;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Deep atmospheric base — two very subtle drifting clouds */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse 60% 40% at ${c1x}% 30%, color-mix(in oklch, var(--cruz-green-2) 6%, transparent) 0%, transparent 60%),
          radial-gradient(ellipse 50% 35% at ${c2x}% 70%, color-mix(in oklch, var(--cruz-ice-2) 4%, transparent) 0%, transparent 60%)
        `,
        filter: 'blur(20px)',
        transition: 'none',
      }}/>

      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
           style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, opacity: 0.42 }}>
        <defs>
          <radialGradient id="ping-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="var(--cruz-green-2)" stopOpacity="1"/>
            <stop offset="70%" stopColor="var(--cruz-green-2)" stopOpacity="0.1"/>
            <stop offset="100%" stopColor="var(--cruz-green-2)" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="river-soft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cruz-ice-2)" stopOpacity="0"/>
            <stop offset="50%" stopColor="var(--cruz-ice-2)" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="var(--cruz-ice-2)" stopOpacity="0"/>
          </linearGradient>
          <pattern id="topo-dots" x="0" y="0" width="3.5" height="3.5" patternUnits="userSpaceOnUse">
            <circle cx="1.75" cy="1.75" r="0.22" fill="var(--cruz-line-2)" opacity="0.35"/>
          </pattern>
          <filter id="soft-glow">
            <feGaussianBlur stdDeviation="0.6"/>
          </filter>
        </defs>

        {/* Landmass dot topography */}
        <rect width="100" height="100" fill="url(#topo-dots)"/>

        {/* Land region labels — delicate, editorial */}
        <g opacity="0.55">
          <text x="8" y="14" fill="var(--cruz-fg-4)" fontSize="2.2" letterSpacing="0.4"
                fontFamily="var(--cruz-font-mono)">TEXAS</text>
          <text x="8" y="17" fill="var(--cruz-fg-5)" fontSize="1.2" letterSpacing="0.3"
                fontFamily="var(--cruz-font-mono)">UNITED STATES · CBP LAREDO</text>

          <text x="80" y="93" fill="var(--cruz-fg-4)" fontSize="2.2" letterSpacing="0.4"
                fontFamily="var(--cruz-font-mono)" textAnchor="end">TAMAULIPAS</text>
          <text x="80" y="96" fill="var(--cruz-fg-5)" fontSize="1.2" letterSpacing="0.3"
                fontFamily="var(--cruz-font-mono)" textAnchor="end">MÉXICO · ADUANA 240</text>
        </g>

        {/* Rio Grande — hand-drawn, flowing */}
        <path d="M 0 52 Q 18 44, 34 52 Q 50 60, 66 52 Q 84 45, 100 54"
              fill="none" stroke="url(#river-soft)" strokeWidth="1.6"/>
        <path d="M 0 52 Q 18 44, 34 52 Q 50 60, 66 52 Q 84 45, 100 54"
              fill="none" stroke="var(--cruz-ice-2)" strokeWidth="0.18" opacity="0.5"/>
        {/* Flow current dashes */}
        <path d="M 0 52 Q 18 44, 34 52 Q 50 60, 66 52 Q 84 45, 100 54"
              fill="none" stroke="var(--cruz-ice-2)" strokeWidth="0.28" strokeDasharray="1.5 6" opacity="0.6">
          <animate attributeName="stroke-dashoffset" from="0" to="-7.5" dur="4s" repeatCount="indefinite"/>
        </path>
        {/* Border dashed */}
        <path d="M 0 52 Q 18 44, 34 52 Q 50 60, 66 52 Q 84 45, 100 54"
              fill="none" stroke="var(--cruz-green-5)" strokeWidth="0.15" strokeDasharray="0.5 0.5" opacity="0.55"/>

        {/* Bridges — delicate spans */}
        {bridges.map((b, i) => (
          <g key={i}>
            <path d={`M 35 ${b.y} Q 50 ${b.y + (i % 2 === 0 ? -0.8 : 0.8)}, 65 ${b.y}`}
                  fill="none" stroke="var(--cruz-fg-4)" strokeWidth="0.28" opacity="0.55"/>
            {/* trucks */}
            {[0, 1, 2].map(lane => {
              const tN = truckOf(b, 'N', lane);
              const tS = truckOf(b, 'S', lane);
              return (
                <g key={lane}>
                  <rect x={tN.x - 0.4} y={tN.y - 0.22} width="0.9" height="0.44" fill="var(--cruz-green-2)" opacity="0.85" rx="0.08"/>
                  <rect x={tS.x - 0.4} y={tS.y - 0.22} width="0.9" height="0.44" fill="var(--cruz-amber)" opacity="0.7" rx="0.08"/>
                </g>
              );
            })}
          </g>
        ))}

        {/* Highway corridor — soft dashed */}
        <path d="M 50 0 L 50 34 L 49 46 L 50 60 L 50 72 L 51 85 L 50 100" fill="none"
              stroke="var(--cruz-line-2)" strokeDasharray="0.4 1.2" strokeWidth="0.18" opacity="0.5"/>

        {/* Pedimento-cleared pings (low freq, beautiful) */}
        {pings.map(p => {
          const age = (performance.now() - p.born) / 4000;
          return (
            <g key={p.id}>
              <circle cx={p.x} cy={p.y} r={0.4 + age * 7} fill="none"
                      stroke="var(--cruz-green-2)" strokeWidth="0.12"
                      opacity={Math.max(0, 1 - age)}/>
              <circle cx={p.x} cy={p.y} r={0.5 + age * 3} fill="none"
                      stroke="var(--cruz-green-2)" strokeWidth="0.08"
                      opacity={Math.max(0, 1 - age) * 0.7}/>
              <circle cx={p.x} cy={p.y} r="0.9" fill="url(#ping-grad)"
                      opacity={Math.max(0, 1 - age * 0.6)}/>
            </g>
          );
        })}

        {/* Compass — top right, quiet */}
        <g transform="translate(94 8)" opacity="0.4">
          <circle cx="0" cy="0" r="2.2" fill="none" stroke="var(--cruz-fg-5)" strokeWidth="0.12"/>
          <line x1="0" y1="-2.2" x2="0" y2="-0.6" stroke="var(--cruz-green-2)" strokeWidth="0.25"/>
          <text x="0" y="-2.7" textAnchor="middle" fill="var(--cruz-fg-3)" fontSize="1" fontFamily="var(--cruz-font-mono)">N</text>
        </g>
      </svg>

      {/* Slow painterly wash over everything for "breathing" feel */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse 45% 35% at 50% 50%, color-mix(in oklch, var(--cruz-green-2) 4%, transparent) 0%, transparent 70%),
          radial-gradient(ellipse 70% 100% at 50% 0%, color-mix(in oklch, var(--cruz-ink-0) 40%, transparent) 0%, transparent 45%),
          radial-gradient(ellipse 70% 100% at 50% 100%, color-mix(in oklch, var(--cruz-ink-0) 40%, transparent) 0%, transparent 45%)
        `,
        mixBlendMode: 'normal',
      }}/>
    </div>
  );
};

/* ==================== LOGIN ==================== */

/* —— LoginLiveWire — a single-line quiet ticker beneath the form ——
   Shows today's border conditions (wait, cruces, CBP, AMSA) rotating through.
   Feels like a distant radio transmission. Unannounced, unhyped. */
const LoginLiveWire = () => {
  const wires = [
    { k: 'LAREDO II',   v: '14 MIN', tag: 'ESPERA',    dot: 'green' },
    { k: 'CRUCES HOY',  v: '38',     tag: 'AL 14:18',  dot: 'green' },
    { k: 'CBP',         v: 'OK',     tag: 'SISTEMAS',  dot: 'green' },
    { k: 'SAT · VUCEM', v: '142ms',  tag: 'LATENCIA',  dot: 'green' },
    { k: 'TX-4829',     v: 'EN RUTA',tag: 'DE 18',     dot: 'green' },
    { k: 'CLIMA',       v: '24°C',   tag: 'DESPEJADO', dot: 'green' },
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const h = setInterval(() => setIdx(i => (i + 1) % wires.length), 2600);
    return () => clearInterval(h);
  }, []);
  const w = wires[idx];
  return (
    <div style={{
      marginTop: 24,
      padding: '10px 14px',
      background: 'color-mix(in oklch, var(--cruz-ink-1) 60%, transparent)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: '1px solid var(--cruz-line-2)',
      borderRadius: 'var(--cruz-r-2)',
      display: 'flex', alignItems: 'center', gap: 10,
      fontFamily: 'var(--cruz-font-mono)', fontSize: 10,
      letterSpacing: '0.22em', textTransform: 'uppercase',
      overflow: 'hidden', whiteSpace: 'nowrap',
      animation: 'portalFadeUp 900ms var(--cruz-ease-out) 500ms both',
    }}>
      <span style={{ position: 'relative', width: 6, height: 6, flexShrink: 0 }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--cruz-green-2)', boxShadow: '0 0 6px var(--cruz-green-glow)' }}/>
      </span>
      <span style={{ color: 'var(--cruz-fg-5)' }}>LÍNEA EN VIVO</span>
      <span style={{ color: 'var(--cruz-line-2)' }}>│</span>
      <span
        key={idx}
        style={{
          color: 'var(--cruz-fg-3)',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
          animation: 'loginWireTick 400ms var(--cruz-ease-out) both',
        }}>
        {w.k} · <span style={{ color: 'var(--cruz-green-2)' }}>{w.v}</span>
        {' '}<span style={{ color: 'var(--cruz-fg-5)' }}>· {w.tag}</span>
      </span>
      <span style={{ color: 'var(--cruz-fg-5)', fontSize: 9 }}>
        {String(idx + 1).padStart(2, '0')}/{String(wires.length).padStart(2, '0')}
      </span>
    </div>
  );
};

const LoginScreen = ({ onEnter }) => {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('idle');
  const [dots, setDots] = useState(0);
  const [clock, setClock] = useState('');
  const [bgVariant, setBgVariant] = useState(() => {
    try { return localStorage.getItem('cruz-login-bg') || 'linemap'; }
    catch { return 'linemap'; }
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    try { localStorage.setItem('cruz-login-bg', bgVariant); } catch {}
  }, [bgVariant]);
  const registry = (typeof window !== 'undefined' && window.BG_REGISTRY) || [];
  const current = registry.find(b => b.id === bgVariant) || registry[0];
  const BgComp = current ? current.comp : LivingBackground;

  useEffect(() => {
    const update = () => {
      const d = new Date();
      const pad = (n) => n.toString().padStart(2, '0');
      setClock(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (status === 'auth') {
      const t = setInterval(() => setDots(d => (d + 1) % 4), 280);
      const ok = setTimeout(() => { setStatus('ok'); setTimeout(onEnter, 500); }, 1400);
      return () => { clearInterval(t); clearTimeout(ok); };
    }
  }, [status, onEnter]);

  const submit = (e) => { e.preventDefault(); if (code.length >= 3) setStatus('auth'); };
  const canSubmit = code.length >= 3;

  const pill = {
    fontFamily: 'var(--cruz-font-mono)',
    fontSize: 10, letterSpacing: '0.18em',
    color: 'var(--cruz-fg-4)', textTransform: 'uppercase',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(ellipse 60% 40% at 50% 50%, color-mix(in oklch, var(--cruz-ink-1) 50%, var(--cruz-ink-0)) 0%, var(--cruz-ink-0) 70%)
      `,
      display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
      color: 'var(--cruz-fg-1)',
    }}>
      {/* Living, slow, very quiet background painting behind everything */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        opacity: 0.55, pointerEvents: 'none',
      }}>
        {BgComp && <BgComp/>}
      </div>
      {/* Simple still background — just a soft green vignette.
          The card + portal dot are the only living things. */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 70% 50% at 50% 45%, color-mix(in oklch, var(--cruz-green-2) 5%, transparent) 0%, transparent 60%),
          radial-gradient(ellipse 100% 100% at 50% 120%, color-mix(in oklch, var(--cruz-green-2) 3%, transparent) 0%, transparent 50%)
        `,
      }}/>
      {/* subtle grid to anchor the depth */}
      <svg aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 1, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.35 }}>
        <defs>
          <pattern id="portal-grid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M64 0H0v64" fill="none" stroke="rgba(255,255,255,0.022)" strokeWidth="1"/>
          </pattern>
          <radialGradient id="portal-grid-mask" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="white" stopOpacity="0"/>
            <stop offset="60%" stopColor="white" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="white" stopOpacity="0.3"/>
          </radialGradient>
          <mask id="portal-grid-mask-m">
            <rect width="100%" height="100%" fill="url(#portal-grid-mask)"/>
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#portal-grid)" mask="url(#portal-grid-mask-m)"/>
      </svg>

      {/* Soft center vignette — gives the card breathing room without creating a box */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 38% 50% at 50% 52%, color-mix(in oklch, var(--cruz-ink-0) 70%, transparent) 0%, color-mix(in oklch, var(--cruz-ink-0) 30%, transparent) 45%, transparent 75%)
        `,
      }}/>

      {/* No top accent line, no header, no footer. Just the card. */}

      {/* TOP BAR */}
      {/* No top nav, no footer. The card is everything. */}

      {/* CENTER — no card, just the wordmark + input, breathing over the map */}
      <main style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 28px', position: 'relative', zIndex: 5,
      }}>
        <div style={{
          width: '100%', maxWidth: 440,
          display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        }}>
          {/* Quiet eyebrow — sets context without volume */}
          <div style={{
            fontFamily: 'var(--cruz-font-mono)', fontSize: 10, letterSpacing: '0.32em',
            color: 'var(--cruz-fg-5)', textTransform: 'uppercase',
            paddingLeft: 'calc(14px + 22px + 0.2em)',
            marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 10,
            animation: 'portalFadeUp 900ms var(--cruz-ease-out) 40ms both',
          }}>
            <span style={{ width: 18, height: 1, background: 'var(--cruz-line-3)' }}/>
            Un sistema de Renato Zapata &amp; Co.
          </div>

          {/* Giant PORTAL wordmark with pulsing dot */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 22,
            marginBottom: 6,
            animation: 'portalFadeUp 900ms var(--cruz-ease-out) 80ms both',
          }}>
            <span style={{ position: 'relative', width: 14, height: 14, flexShrink: 0 }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--cruz-green-2)', boxShadow: '0 0 16px var(--cruz-green-glow)', animation: 'portalDotPulse 2.4s ease-in-out infinite' }}/>
              <span style={{ position: 'absolute', inset: -6, borderRadius: 999, border: '1px solid var(--cruz-green-2)', opacity: 0.55, animation: 'portalPing 2.4s ease-out infinite' }}/>
              <span style={{ position: 'absolute', inset: -6, borderRadius: 999, border: '1px solid var(--cruz-green-2)', opacity: 0.35, animation: 'portalPing 2.4s ease-out 1.2s infinite' }}/>
            </span>
            <span style={{
              fontFamily: 'var(--cruz-font-display)',
              fontSize: 'clamp(44px, 6.5vw, 68px)',
              fontWeight: 300,
              letterSpacing: '0.28em',
              color: 'var(--cruz-fg-1)',
              textShadow: '0 0 32px color-mix(in oklch, var(--cruz-green-2) 14%, transparent)',
              lineHeight: 1,
              paddingLeft: '0.2em',
            }}>PORTAL</span>
          </div>

          {/* Quiet subtitle — agency + patente */}
          <div style={{
            fontFamily: 'var(--cruz-font-mono)', fontSize: 11, letterSpacing: '0.28em',
            color: 'var(--cruz-fg-4)', textTransform: 'uppercase',
            paddingLeft: 'calc(14px + 22px + 0.2em)',
            marginBottom: 20,
            animation: 'portalFadeUp 900ms var(--cruz-ease-out) 180ms both',
          }}>
            Patente <span style={{ color: 'var(--cruz-fg-2)' }}>3596</span> · Aduana <span style={{ color: 'var(--cruz-fg-2)' }}>240</span> · <span style={{ color: 'var(--cruz-green-3)' }}>Laredo TX ↔ Nuevo Laredo TAMPS</span>
          </div>

          {/* Delicate divider under the header block — rests the eye */}
          <div style={{
            height: 1, width: '100%',
            background: 'linear-gradient(90deg, transparent 0%, var(--cruz-line-2) 30%, var(--cruz-line-2) 70%, transparent 100%)',
            marginBottom: 36,
            animation: 'portalFadeUp 900ms var(--cruz-ease-out) 260ms both',
          }}/>

          {/* THE access input — single field, big, beautiful */}
          <form onSubmit={submit} style={{
            width: '100%',
            animation: 'portalFadeUp 900ms var(--cruz-ease-out) 320ms both',
          }}>
            <div style={{ position: 'relative' }}>
              <label htmlFor="portal-code" style={{
                display: 'block',
                fontFamily: 'var(--cruz-font-mono)',
                fontSize: 10, fontWeight: 500, letterSpacing: '0.28em',
                color: 'var(--cruz-fg-4)', textTransform: 'uppercase',
                textAlign: 'left',
                marginBottom: 12, marginLeft: 2,
              }}>
                Contraseña
              </label>
              <input
                id="portal-code"
                type="password"
                value={code}
                onChange={e => setCode(e.target.value.slice(0, 24))}
                placeholder="········"
                autoFocus
                autoComplete="current-password"
                disabled={status !== 'idle'}
                style={{
                  width: '100%',
                  padding: '22px 22px',
                  background: 'color-mix(in oklch, var(--cruz-ink-1) 80%, transparent)',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                  border: '1px solid ' + (code.length ? 'var(--cruz-green-3)' : 'var(--cruz-line-2)'),
                  borderRadius: 'var(--cruz-r-4)',
                  fontFamily: 'var(--cruz-font-sans)',
                  fontSize: 17, fontWeight: 400,
                  letterSpacing: code.length ? '0.3em' : '0.01em',
                  textAlign: 'left',
                  color: 'var(--cruz-fg-1)',
                  outline: 'none',
                  boxShadow: code.length ? '0 0 0 3px var(--cruz-green-glow), 0 12px 40px -12px rgba(0,0,0,0.6)' : '0 12px 40px -12px rgba(0,0,0,0.6)',
                  transition: 'all var(--cruz-dur-2) var(--cruz-ease-out)',
                  boxSizing: 'border-box',
                  caretColor: 'var(--cruz-green-2)',
                }}
                onFocus={e => {
                  if (!code.length) e.target.style.borderColor = 'var(--cruz-green-5)';
                }}
                onBlur={e => {
                  if (!code.length) e.target.style.borderColor = 'var(--cruz-line-2)';
                }}
              />
            </div>

            <button type="submit" disabled={!canSubmit || status !== 'idle'} style={{
              width: '100%',
              marginTop: 14,
              padding: '18px 20px',
              background: canSubmit ? 'var(--cruz-green-2)' : 'color-mix(in oklch, var(--cruz-ink-2) 80%, transparent)',
              color: canSubmit ? 'var(--cruz-ink-0)' : 'var(--cruz-fg-5)',
              border: '1px solid ' + (canSubmit ? 'var(--cruz-green-2)' : 'var(--cruz-line-2)'),
              borderRadius: 'var(--cruz-r-4)',
              fontFamily: 'var(--cruz-font-sans)',
              fontSize: 15, fontWeight: 600, letterSpacing: '0.04em',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? '0 0 32px var(--cruz-green-glow), 0 10px 30px -8px var(--cruz-green-3)' : 'none',
              transition: 'all var(--cruz-dur-2) var(--cruz-ease-out)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              backdropFilter: canSubmit ? 'none' : 'blur(10px)',
            }}>
              {status === 'idle' && <>Entrar <span style={{ fontSize: 18 }}>→</span></>}
              {status === 'auth' && <>Verificando{'.'.repeat(dots)}</>}
              {status === 'ok' && <>✓  Acceso concedido</>}
            </button>

            {/* Live wire — compact always-on strip showing today's border heartbeat */}
            <LoginLiveWire/>

            <div style={{
              marginTop: 18,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontFamily: 'var(--cruz-font-mono)', fontSize: 10, letterSpacing: '0.22em',
              color: 'var(--cruz-fg-5)', textTransform: 'uppercase',
            }}>
              <span>
                <Icon name="shield" size={10} style={{ marginRight: 6, verticalAlign: '-1px' }}/>
                TLS 1.3 · 2FA
              </span>
              <button type="button" style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontFamily: 'var(--cruz-font-mono)', fontSize: 10, letterSpacing: '0.22em',
                color: 'var(--cruz-fg-4)', textTransform: 'uppercase',
              }}>
                ¿Olvidó su código?
              </button>
            </div>
          </form>
        </div>
      </main>
      {/* Footer removed — keep it clean */}

      <style>{`
        @keyframes portalBreathe {
          0%, 100% { box-shadow: inset 0 0 40px color-mix(in oklch, var(--cruz-green-2) 4%, transparent), 0 0 50px -12px color-mix(in oklch, var(--cruz-green-2) 20%, transparent); }
          50%      { box-shadow: inset 0 0 50px color-mix(in oklch, var(--cruz-green-2) 8%, transparent), 0 0 70px -10px color-mix(in oklch, var(--cruz-green-2) 32%, transparent); }
        }
        @keyframes portalCardScan {
          0%   { top: -4%; opacity: 0; }
          10%  { opacity: 0.7; }
          90%  { opacity: 0.7; }
          100% { top: 104%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

Object.assign(window, { LoginScreen });
