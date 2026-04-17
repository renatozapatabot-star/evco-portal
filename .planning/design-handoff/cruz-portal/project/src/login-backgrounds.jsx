/* PORTAL — Background variant library.
   Each Bg_* component is a full-screen living background, zIndex:1.
   All share the same API: no props, self-contained animation.
   Swap between them via the picker in LoginScreen.
*/

/* ====================================================================
   #1 — EL PASO DEL TIEMPO
   An 85-year scene that drifts from 1941 sepia to modern border.
   Wide cinematic scene; decade overlay gently advances.
   ==================================================================== */
const Bg_TimeFade = () => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase(((t - t0) / 1000 / 90) % 1); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  // phase 0 → 1 across 90s. Interpolate: sepia(0.9)→0, contrast/saturation up
  const year = Math.round(1941 + phase * 85);
  const sepia = 0.85 - phase * 0.85;
  const hue = phase * 30;
  const brightness = 0.7 + phase * 0.4;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden' }}>
      {/* Aged paper / landscape base */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse 80% 60% at 50% 60%, #c4a87850 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 50% 30%, #e8d4a855 0%, transparent 55%),
          linear-gradient(to bottom, #2a1d0f 0%, #1a1309 50%, #0f0a05 100%)
        `,
        filter: `sepia(${sepia}) hue-rotate(${hue}deg) brightness(${brightness})`,
        transition: 'filter 1.2s linear',
      }}/>
      {/* Horizon hills */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax slice"
           style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, opacity: 0.7 }}>
        <path d="M0 70 L15 65 L30 68 L50 62 L70 66 L85 64 L100 67 L100 100 L0 100 Z"
              fill="#1a120a" opacity="0.85"/>
        <path d="M0 80 L20 77 L40 79 L60 76 L80 78 L100 77 L100 100 L0 100 Z" fill="#0a0704"/>
        {/* sun/moon — slowly moves */}
        <circle cx={20 + phase * 60} cy={30 - phase * 5} r="4"
                fill={phase < 0.5 ? '#f4c870' : '#e8e8e8'} opacity="0.4"/>
        {/* trucks: modernize with time */}
        <g transform={`translate(${(phase * 2) % 1 * 120 - 20} 75)`}>
          <rect width={phase < 0.3 ? 4 : 6} height="2" fill="#3a2a15"/>
          <circle cx="1" cy="2.5" r="0.5" fill="#0a0704"/>
          <circle cx={phase < 0.3 ? 3 : 5} cy="2.5" r="0.5" fill="#0a0704"/>
        </g>
      </svg>
      {/* Year overlay - bottom left */}
      <div style={{
        position: 'absolute', left: 28, bottom: 60, zIndex: 2,
        fontFamily: 'var(--cruz-font-mono)', fontSize: 56, fontWeight: 500,
        color: '#e8d4a8', opacity: 0.35, letterSpacing: '0.08em',
        fontVariantNumeric: 'tabular-nums',
        transition: 'color 1s',
      }}>
        {year}
      </div>
    </div>
  );
};

/* ====================================================================
   #2 — PEDIMENTO CONSTELLATION
   Mexico + Texas rendered as dot-galaxy of historical pedimentos.
   ==================================================================== */
const Bg_Constellation = () => {
  const [phase, setPhase] = useState(0);
  const stars = useMemo(() => {
    // Mexico + TX outline bounded stars
    const pts = [];
    const inMX = (x, y) => {
      // rough MX outline box check
      return (x > 18 && x < 82 && y > 35 && y < 92 &&
              !((x < 30 && y < 45) || (x > 70 && y < 50)));
    };
    const onBorder = (x, y) => (y > 48 && y < 54 && x > 20 && x < 60);
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      if (inMX(x, y) || onBorder(x, y)) {
        pts.push({
          x, y,
          size: 0.15 + Math.random() * 0.35,
          base: 0.25 + Math.random() * 0.45,
          phase: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 1.5,
        });
      }
    }
    return pts;
  }, []);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase((t - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden',
      background: 'radial-gradient(ellipse 80% 60% at 50% 50%, color-mix(in oklch, var(--cruz-green-2) 3%, var(--cruz-ink-0)) 0%, var(--cruz-ink-0) 70%)' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
           style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
        {stars.map((s, i) => {
          const opacity = s.base + Math.sin(phase * s.speed + s.phase) * 0.25;
          return <circle key={i} cx={s.x} cy={s.y} r={s.size}
                         fill={s.y > 48 && s.y < 54 ? 'var(--cruz-green-2)' : 'var(--cruz-fg-2)'}
                         opacity={Math.max(0.1, opacity)}/>;
        })}
      </svg>
      <div style={{
        position: 'absolute', left: 28, bottom: 70, zIndex: 2,
        fontFamily: 'var(--cruz-font-mono)', fontSize: 10, letterSpacing: '0.2em',
        color: 'var(--cruz-fg-5)', textTransform: 'uppercase', opacity: 0.7,
      }}>
        1,248,731 pedimentos · 1941—2026
      </div>
    </div>
  );
};

/* ====================================================================
   #3 — LINE-ART NUEVO LAREDO (the current map, refined)
   A hand-drawn 1950s customs map feel. Trucks still drift.
   ==================================================================== */
const Bg_LineMap = () => {
  const [phase, setPhase] = useState(0);
  const [pings, setPings] = useState([]);
  const pingIdRef = useRef(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase((t - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const pts = [{ x: 48, y: 34 }, { x: 50, y: 46 }, { x: 52, y: 60 }, { x: 51, y: 72 }];
    const spawn = () => {
      const p = pts[Math.floor(Math.random() * pts.length)];
      const id = ++pingIdRef.current;
      setPings(prev => [...prev, { id, x: p.x, y: p.y, born: performance.now() }]);
      setTimeout(() => setPings(prev => prev.filter(x => x.id !== id)), 4000);
    };
    const i = setInterval(spawn, 2400); spawn();
    return () => clearInterval(i);
  }, []);
  const bridges = [{ y: 34, s: 22 }, { y: 46, s: 18 }, { y: 60, s: 26 }, { y: 72, s: 30 }];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden',
      background: 'var(--cruz-ink-0)' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
           style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, opacity: 0.45 }}>
        <defs>
          <pattern id="ha-us" patternUnits="userSpaceOnUse" width="2" height="2" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="2" stroke="var(--cruz-line-2)" strokeWidth="0.1"/>
          </pattern>
          <pattern id="ha-mx" patternUnits="userSpaceOnUse" width="2" height="2" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="2" stroke="var(--cruz-line-2)" strokeWidth="0.1"/>
          </pattern>
          <radialGradient id="lm-ping">
            <stop offset="0%" stopColor="var(--cruz-green-2)" stopOpacity="1"/>
            <stop offset="100%" stopColor="var(--cruz-green-2)" stopOpacity="0"/>
          </radialGradient>
        </defs>
        {/* Hatched landmasses */}
        <path d="M 0 0 L 100 0 L 100 50 Q 82 43, 66 50 Q 50 58, 34 50 Q 18 42, 0 50 Z" fill="url(#ha-us)"/>
        <path d="M 0 52 Q 18 44, 34 52 Q 50 60, 66 52 Q 84 45, 100 54 L 100 100 L 0 100 Z" fill="url(#ha-mx)"/>
        {/* River */}
        <path d="M 0 51 Q 18 43, 34 51 Q 50 59, 66 51 Q 84 44, 100 53"
              fill="none" stroke="var(--cruz-ice-2)" strokeWidth="0.4" opacity="0.8"/>
        {/* Country labels in serif */}
        <text x="50" y="18" fill="var(--cruz-fg-3)" fontSize="5" letterSpacing="0.4"
              fontFamily="var(--cruz-font-serif)" fontStyle="italic" textAnchor="middle" opacity="0.5">Texas</text>
        <text x="50" y="92" fill="var(--cruz-fg-3)" fontSize="5" letterSpacing="0.4"
              fontFamily="var(--cruz-font-serif)" fontStyle="italic" textAnchor="middle" opacity="0.5">Tamaulipas</text>
        {/* Bridges w/ trucks */}
        {bridges.map((b, i) => (
          <g key={i}>
            <path d={`M 35 ${b.y} Q 50 ${b.y + (i%2?0.8:-0.8)}, 65 ${b.y}`}
                  fill="none" stroke="var(--cruz-fg-3)" strokeWidth="0.2" opacity="0.7"/>
            {[0,1,2].map(l => {
              const t = ((phase + l*(b.s/3)) / b.s) % 1;
              return (
                <g key={l}>
                  <rect x={35 + t*30 - 0.4} y={b.y - 0.5} width="0.8" height="0.4" fill="var(--cruz-green-2)" opacity="0.8"/>
                  <rect x={65 - t*30 - 0.4} y={b.y + 0.1} width="0.8" height="0.4" fill="var(--cruz-amber)" opacity="0.7"/>
                </g>
              );
            })}
          </g>
        ))}
        {pings.map(p => {
          const age = (performance.now() - p.born) / 4000;
          return (
            <circle key={p.id} cx={p.x} cy={p.y} r={0.5 + age * 6}
                    fill="none" stroke="var(--cruz-green-2)" strokeWidth="0.12"
                    opacity={Math.max(0, 1 - age)}/>
          );
        })}
      </svg>
    </div>
  );
};

/* ====================================================================
   #4 — THE FLOW
   Abstract drifting current of geometric shapes from left to right.
   ==================================================================== */
const Bg_Flow = () => {
  const [phase, setPhase] = useState(0);
  const shapes = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 90; i++) {
      arr.push({
        y: Math.random() * 100,
        size: 0.4 + Math.random() * 1.2,
        speed: 0.02 + Math.random() * 0.05,
        offset: Math.random(),
        kind: Math.random() > 0.7 ? 'square' : 'circle',
        wobble: Math.random() * 4,
      });
    }
    return arr;
  }, []);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase((t - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden',
      background: `
        linear-gradient(to bottom,
          color-mix(in oklch, var(--cruz-ice-2) 4%, var(--cruz-ink-0)) 0%,
          var(--cruz-ink-0) 40%,
          color-mix(in oklch, var(--cruz-green-2) 3%, var(--cruz-ink-0)) 100%)` }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
           style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
        {shapes.map((s, i) => {
          const t = ((phase * s.speed + s.offset) % 1.2) - 0.1;
          const x = t * 110;
          const y = s.y + Math.sin(phase * 0.4 + s.wobble) * 1.5;
          const op = Math.max(0, Math.min(1, 1 - Math.abs(t - 0.5) * 2)) * 0.6;
          if (s.kind === 'square') {
            return <rect key={i} x={x} y={y} width={s.size} height={s.size * 0.4}
                         fill="var(--cruz-green-2)" opacity={op}/>;
          }
          return <circle key={i} cx={x} cy={y} r={s.size * 0.3}
                         fill="var(--cruz-fg-2)" opacity={op * 0.8}/>;
        })}
      </svg>
    </div>
  );
};

/* ====================================================================
   #5 — SATELLITE
   Slow-drifting grayscale satellite feel with crosshair overlays.
   ==================================================================== */
const Bg_Satellite = () => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase((t - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const pan = (phase * 0.3) % 100;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden' }}>
      {/* Satellite-photo style base using many varied rectangles */}
      <div style={{
        position: 'absolute', inset: '-10%',
        transform: `translateX(${-pan / 4}px)`,
        background: `
          radial-gradient(ellipse 40% 30% at 30% 40%, #3a4238 0%, transparent 50%),
          radial-gradient(ellipse 35% 25% at 60% 55%, #2e3530 0%, transparent 50%),
          radial-gradient(ellipse 30% 20% at 80% 70%, #4a5046 0%, transparent 50%),
          radial-gradient(ellipse 50% 30% at 20% 75%, #32382f 0%, transparent 50%),
          linear-gradient(to bottom, #1c1f1a 0%, #13150f 100%)
        `,
        filter: 'blur(1px) contrast(1.1)',
      }}/>
      {/* Scanline overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px)',
        mixBlendMode: 'multiply',
      }}/>
      {/* Grid */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
           style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, opacity: 0.2 }}>
        {Array.from({length: 10}).map((_, i) => (
          <line key={`v${i}`} x1={i*10} y1="0" x2={i*10} y2="100" stroke="var(--cruz-green-2)" strokeWidth="0.08"/>
        ))}
        {Array.from({length: 10}).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i*10} x2="100" y2={i*10} stroke="var(--cruz-green-2)" strokeWidth="0.08"/>
        ))}
        {/* Targeting reticles on moving points */}
        {[{x: 30 + Math.sin(phase*0.3)*5, y: 45},
          {x: 55 + Math.cos(phase*0.2)*4, y: 60},
          {x: 72, y: 35 + Math.sin(phase*0.4)*3}].map((p, i) => (
          <g key={i} opacity="0.7">
            <circle cx={p.x} cy={p.y} r="2.5" fill="none" stroke="var(--cruz-green-2)" strokeWidth="0.15"/>
            <line x1={p.x-4} y1={p.y} x2={p.x-2.5} y2={p.y} stroke="var(--cruz-green-2)" strokeWidth="0.15"/>
            <line x1={p.x+2.5} y1={p.y} x2={p.x+4} y2={p.y} stroke="var(--cruz-green-2)" strokeWidth="0.15"/>
            <line x1={p.x} y1={p.y-4} x2={p.x} y2={p.y-2.5} stroke="var(--cruz-green-2)" strokeWidth="0.15"/>
            <line x1={p.x} y1={p.y+2.5} x2={p.x} y2={p.y+4} stroke="var(--cruz-green-2)" strokeWidth="0.15"/>
            <text x={p.x + 3} y={p.y - 2} fontSize="1" fill="var(--cruz-green-2)" fontFamily="var(--cruz-font-mono)">27.50°N</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

/* ====================================================================
   #6 — PAPER & STAMP
   A close-up pedimento on aged paper. Stamps fall periodically.
   ==================================================================== */
const Bg_Paper = () => {
  const [stamps, setStamps] = useState([]);
  const stampId = useRef(0);
  useEffect(() => {
    const spawn = () => {
      const id = ++stampId.current;
      setStamps(prev => [...prev, {
        id,
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 70,
        rot: (Math.random() - 0.5) * 30,
        born: performance.now(),
      }]);
      setTimeout(() => setStamps(prev => prev.filter(s => s.id !== id)), 6000);
    };
    const i = setInterval(spawn, 3800); spawn();
    return () => clearInterval(i);
  }, []);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden',
      background: `
        radial-gradient(ellipse 100% 80% at 50% 50%, #2a2419 0%, #1a1610 60%, #0f0d08 100%)` }}>
      {/* Paper texture — subtle noise */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent 0, transparent 1px, rgba(200,180,140,0.02) 1px, rgba(200,180,140,0.02) 2px),
          repeating-linear-gradient(90deg, transparent 0, transparent 1px, rgba(200,180,140,0.02) 1px, rgba(200,180,140,0.02) 2px)`,
        mixBlendMode: 'overlay',
      }}/>
      {/* Pedimento document layout */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
           style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, opacity: 0.32 }}>
        <defs>
          <filter id="ink-spread">
            <feGaussianBlur stdDeviation="0.12"/>
          </filter>
        </defs>
        {/* Header band */}
        <rect x="10" y="8" width="80" height="6" fill="none" stroke="#c4a878" strokeWidth="0.15"/>
        <text x="50" y="12.5" textAnchor="middle" fontSize="2.4" letterSpacing="0.4"
              fontFamily="var(--cruz-font-serif)" fontStyle="italic" fill="#c4a878">Pedimento de Importación</text>
        {/* Field grid */}
        {Array.from({length: 12}).map((_, i) => {
          const row = Math.floor(i / 3), col = i % 3;
          return (
            <g key={i}>
              <rect x={10 + col * 27} y={18 + row * 14} width="26" height="12"
                    fill="none" stroke="#c4a878" strokeWidth="0.12" opacity="0.5"/>
              <text x={11 + col * 27} y={21 + row * 14} fontSize="1.2" fill="#c4a878" opacity="0.6"
                    fontFamily="var(--cruz-font-mono)" letterSpacing="0.15">CAMPO {i+1}</text>
              <text x={11 + col * 27} y={27 + row * 14} fontSize="2.2" fill="#e8d4a8" opacity="0.7"
                    fontFamily="var(--cruz-font-mono)">{Math.floor(Math.random()*99999).toString().padStart(5,'0')}</text>
            </g>
          );
        })}
        {/* Stamps */}
        {stamps.map(s => {
          const age = (performance.now() - s.born) / 6000;
          const drop = age < 0.15 ? (1 - age / 0.15) * 8 : 0;
          const opacity = age < 0.15 ? (age / 0.15) : Math.max(0, 1 - (age - 0.15) * 1.2);
          return (
            <g key={s.id} transform={`translate(${s.x} ${s.y - drop}) rotate(${s.rot})`} opacity={opacity} filter="url(#ink-spread)">
              <circle cx="0" cy="0" r="5.5" fill="none" stroke="#d4614a" strokeWidth="0.4"/>
              <circle cx="0" cy="0" r="4.8" fill="none" stroke="#d4614a" strokeWidth="0.2"/>
              <text x="0" y="0.8" textAnchor="middle" fontSize="1.6" fontWeight="700" letterSpacing="0.2"
                    fill="#d4614a" fontFamily="var(--cruz-font-mono)">AUTORIZADO</text>
              <text x="0" y="-2.2" textAnchor="middle" fontSize="0.9" letterSpacing="0.3"
                    fill="#d4614a" fontFamily="var(--cruz-font-mono)">ADUANA 240</text>
              <text x="0" y="3" textAnchor="middle" fontSize="0.9" letterSpacing="0.3"
                    fill="#d4614a" fontFamily="var(--cruz-font-mono)">2026</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/* ====================================================================
   #7 — TOPO-LINE LANDSCAPE
   Slow breathing contour lines of the Rio Grande valley.
   ==================================================================== */
const Bg_Topo = () => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase((t - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden',
      background: 'radial-gradient(ellipse 80% 60% at 50% 50%, color-mix(in oklch, var(--cruz-green-2) 4%, var(--cruz-ink-0)) 0%, var(--cruz-ink-0) 70%)' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
           style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, opacity: 0.45 }}>
        {Array.from({length: 22}).map((_, i) => {
          const breath = Math.sin(phase * 0.25 + i * 0.2) * 0.5;
          const centerY = 50 + breath;
          // irregular contour — simulate valley
          const pts = [];
          for (let x = 0; x <= 100; x += 2) {
            const wave = Math.sin((x + phase * 3 + i * 4) * 0.08) * 6 + Math.sin((x + i) * 0.03) * 12;
            const thickness = 2.2 * i - 20 + wave;
            const y = centerY + thickness;
            pts.push(`${x} ${y}`);
          }
          const op = 0.3 + (i % 4) * 0.15;
          return <polyline key={i} points={pts.join(' L ')} fill="none"
                           stroke={i === 11 ? 'var(--cruz-ice-2)' : 'var(--cruz-fg-4)'}
                           strokeWidth={i === 11 ? 0.25 : 0.12} opacity={op}/>;
        })}
      </svg>
      <div style={{
        position: 'absolute', right: 28, bottom: 60, zIndex: 2,
        fontFamily: 'var(--cruz-font-mono)', fontSize: 10, letterSpacing: '0.2em',
        color: 'var(--cruz-fg-5)', textTransform: 'uppercase', opacity: 0.6,
      }}>
        RIO GRANDE VALLEY · 138m MSL
      </div>
    </div>
  );
};

/* ====================================================================
   #8 — WEATHER OVER THE BORDER
   Drifting cloud layers with occasional lightning flash.
   ==================================================================== */
const Bg_Weather = () => {
  const [phase, setPhase] = useState(0);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase((t - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const strikes = setInterval(() => {
      if (Math.random() > 0.4) {
        setFlash(1);
        setTimeout(() => setFlash(0.3), 80);
        setTimeout(() => setFlash(0), 200);
      }
    }, 5500);
    return () => { cancelAnimationFrame(raf); clearInterval(strikes); };
  }, []);
  const c1 = (-60 + (phase * 0.4) % 200);
  const c2 = (-40 + (phase * 0.25 + 80) % 200);
  const c3 = (-80 + (phase * 0.55 + 40) % 220);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden',
      background: `radial-gradient(ellipse 100% 70% at 50% 50%, #1a2028 0%, #0a0d11 100%)` }}>
      {/* Cloud layers */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse 50% 30% at ${c1}% 40%, rgba(180,200,220,0.12) 0%, transparent 60%),
          radial-gradient(ellipse 45% 28% at ${c2}% 55%, rgba(150,170,190,0.1) 0%, transparent 60%),
          radial-gradient(ellipse 60% 35% at ${c3}% 70%, rgba(200,210,225,0.08) 0%, transparent 60%)`,
        filter: 'blur(12px)',
      }}/>
      {/* Lightning flash */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 30% 30% at 78% 62%, rgba(220,230,255,${flash * 0.4}) 0%, transparent 60%)`,
        transition: 'background 0.08s',
      }}/>
      {/* Faint border + bridge dots */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
           style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, opacity: 0.35 }}>
        <path d="M 0 52 Q 18 44, 34 52 Q 50 60, 66 52 Q 84 45, 100 54"
              fill="none" stroke="var(--cruz-ice-2)" strokeWidth="0.3" strokeDasharray="0.5 0.5"/>
        {[{x:48,y:34},{x:50,y:46},{x:52,y:60},{x:51,y:72}].map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="0.8" fill="var(--cruz-green-2)"/>
            <circle cx={p.x} cy={p.y} r="2" fill="none" stroke="var(--cruz-green-2)" strokeWidth="0.1" opacity="0.5">
              <animate attributeName="r" values="1;3;1" dur="3s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.7;0;0.7" dur="3s" repeatCount="indefinite"/>
            </circle>
          </g>
        ))}
        <text x="48" y="32" fontSize="1.2" fill="var(--cruz-green-2)" fontFamily="var(--cruz-font-mono)" textAnchor="end" opacity="0.8">COLOMBIA</text>
        <text x="54" y="46" fontSize="1.2" fill="var(--cruz-green-2)" fontFamily="var(--cruz-font-mono)" opacity="0.8">PUENTE II</text>
      </svg>
    </div>
  );
};

/* ====================================================================
   #9 — THE LEDGER
   Endless scrolling ledger of pedimento entries (typewriter style).
   ==================================================================== */
const Bg_Ledger = () => {
  const entries = useMemo(() => {
    const a = [];
    const cos = ['MARTIN-ARMSTRONG TX', 'SUMITOMO ELEC MX', 'JUGUETES SARAH', 'APTIV MEX', 'SIEMENS HEALTH', 'NEMAK REGIO', 'GM POWERTRAIN', 'CEMEX USA', 'LG ELECTRONICS', 'DAIMLER MEX', 'BMW TOLUCA', 'BRIDGESTONE', 'SAM ENGINEERING', 'JOHN DEERE', 'WHIRLPOOL MEX'];
    const fracs = ['8471.30.01', '8708.29.99', '9503.00.99', '8544.30.99', '9018.90.99', '7616.10.99', '8482.10.01', '2523.29.01', '8528.72.01', '8708.80.99', '8703.23.01', '4011.10.99', '9030.33.99', '8433.59.99', '8418.69.99'];
    for (let i = 0; i < 60; i++) {
      a.push({
        ped: `24 24 ${String(Math.floor(Math.random()*9000)+1000)} 3001${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`,
        co: cos[i % cos.length],
        frac: fracs[i % fracs.length],
        val: `$${(Math.random() * 900000 + 10000).toLocaleString('en-US', {maximumFractionDigits:0})}`,
        date: `${Math.floor(Math.random()*27+1).toString().padStart(2,'0')} · ${['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][i%12]} · ${1941 + (i*1.4|0) % 85}`,
      });
    }
    return a;
  }, []);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden',
      background: 'var(--cruz-ink-0)' }}>
      <div style={{
        position: 'absolute', inset: 0,
        padding: '60px 60px',
        animation: 'bg-ledger-scroll 90s linear infinite',
        fontFamily: 'var(--cruz-font-mono)', fontSize: 11,
        letterSpacing: '0.05em', color: 'var(--cruz-fg-4)',
        opacity: 0.32, whiteSpace: 'pre', lineHeight: 1.8,
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
      }}>
        {[...entries, ...entries].map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 40, borderBottom: '1px dashed color-mix(in oklch, var(--cruz-line-2) 40%, transparent)', padding: '6px 0' }}>
            <span style={{ color: 'var(--cruz-fg-2)', width: 160 }}>{e.ped}</span>
            <span style={{ width: 210 }}>{e.co}</span>
            <span style={{ color: 'var(--cruz-green-3)', width: 110 }}>{e.frac}</span>
            <span style={{ width: 110, textAlign: 'right' }}>{e.val}</span>
            <span style={{ color: 'var(--cruz-fg-5)' }}>{e.date}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes bg-ledger-scroll {
        0% { transform: translateY(0); }
        100% { transform: translateY(-50%); }
      }`}</style>
    </div>
  );
};

/* ====================================================================
   #10 — DUSK HORIZON
   Top half sky, bottom half topography, login sits on the horizon.
   ==================================================================== */
const Bg_Dusk = () => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase((t - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden' }}>
      {/* Sky gradient — shifts hue slowly */}
      <div style={{
        position: 'absolute', inset: 0, height: '55%',
        background: `linear-gradient(to bottom,
          oklch(0.22 0.03 ${280 + Math.sin(phase*0.05)*20}) 0%,
          oklch(0.28 0.06 ${30 + Math.sin(phase*0.05)*10}) 55%,
          oklch(0.25 0.04 ${20}) 95%,
          transparent 100%)`,
      }}/>
      {/* Stars */}
      <svg viewBox="0 0 100 55" preserveAspectRatio="none"
           style={{ position: 'absolute', inset: 0, width: '100%', height: '55%' }}>
        {Array.from({length: 60}).map((_, i) => (
          <circle key={i} cx={(i * 13 + 7) % 100} cy={(i * 7 + 3) % 40}
                  r={0.15 + (i % 3) * 0.08}
                  fill="#f6e8c3" opacity={0.3 + ((i * 17) % 7) / 10}>
            <animate attributeName="opacity" values={`${0.3 + ((i*17)%7)/10};0.7;${0.3 + ((i*17)%7)/10}`} dur={`${3 + i%4}s`} repeatCount="indefinite"/>
          </circle>
        ))}
      </svg>
      {/* Horizon ground */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '55%', bottom: 0,
        background: `linear-gradient(to bottom,
          oklch(0.15 0.02 40) 0%,
          oklch(0.08 0.01 40) 100%)`,
      }}/>
      {/* Moving headlights on I-35 */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
           style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {Array.from({length: 8}).map((_, i) => {
          const t = ((phase * 0.06 + i * 0.2) % 1);
          const x = t * 100;
          const y = 62 + (i % 3) * 6 + Math.sin(x * 0.1) * 1.5;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="0.3" fill="#fff4d0" opacity="0.9"/>
              <circle cx={x} cy={y} r="1.2" fill="#fff4d0" opacity="0.2"/>
            </g>
          );
        })}
      </svg>
      {/* Distant customs gantry lights */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {[30, 50, 70].map((x, i) => (
          <g key={i}>
            <rect x={x - 0.15} y="52" width="0.3" height="4" fill="#2a2520" opacity="0.7"/>
            <circle cx={x} cy="52" r="0.25" fill="#ff5a3c">
              <animate attributeName="opacity" values="0.3;1;0.3" dur={`${1.8 + i*0.3}s`} repeatCount="indefinite"/>
            </circle>
          </g>
        ))}
      </svg>
    </div>
  );
};

/* ---------------- Picker & Registry ---------------- */
const BG_REGISTRY = [
  { id: 'timefade',     name: '1. El Paso del Tiempo',    comp: Bg_TimeFade },
  { id: 'constellation',name: '2. Pedimento Constellation',comp: Bg_Constellation },
  { id: 'linemap',      name: '3. Line-art Nuevo Laredo', comp: Bg_LineMap },
  { id: 'flow',         name: '4. The Flow',              comp: Bg_Flow },
  { id: 'satellite',    name: '5. Satellite',             comp: Bg_Satellite },
  { id: 'paper',        name: '6. Paper & Stamp',         comp: Bg_Paper },
  { id: 'topo',         name: '7. Topo Landscape',        comp: Bg_Topo },
  { id: 'weather',      name: '8. Border Weather',        comp: Bg_Weather },
  { id: 'ledger',       name: '9. The Ledger',            comp: Bg_Ledger },
  { id: 'dusk',         name: '10. Dusk Horizon',         comp: Bg_Dusk },
];

Object.assign(window, { BG_REGISTRY, Bg_TimeFade, Bg_Constellation, Bg_LineMap, Bg_Flow, Bg_Satellite, Bg_Paper, Bg_Topo, Bg_Weather, Bg_Ledger, Bg_Dusk });
