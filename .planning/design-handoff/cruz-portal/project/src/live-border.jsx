/* —— LA FRONTERA EN VIVO — the living hero of the whole product —————————
   A wide panel above the module grid. Shows the Laredo–Colombia crossing
   in real time: Mexican side on the right, US side on the left, bridge
   across the Rio Grande in the middle. Three trucks animate across the
   bridge. When the lead truck crosses the border midpoint, a global
   "crossing event" fires — the world pulses.

   Exposes:
     <LiveBorderHero/>                — the hero panel
     window.__cruzCrossingBus          — pub/sub for crossing events
     window.__cruzCrossingBus.emit()  — manual fire
*/

const { useState: useBorderState, useEffect: useBorderEffect, useRef: useBorderRef } = React;

/* —— Event bus for crossing moments — any component can subscribe ———— */
(function setupCrossingBus() {
  if (typeof window === 'undefined' || window.__cruzCrossingBus) return;
  const subs = new Set();
  window.__cruzCrossingBus = {
    on: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    emit: (evt) => { subs.forEach(fn => { try { fn(evt); } catch {} }); },
  };
})();

/* —— Single truck on the bridge — animates left→right (MX→US) ———— */
const BridgeTruck = ({ delay, speed, label, onCross, active }) => {
  const [t, setT] = useBorderState(0); // 0..1 position along bridge
  const crossedRef = useBorderRef(false);
  useBorderEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (now) => {
      const elapsed = (now - t0) / 1000 - delay;
      if (elapsed < 0) { raf = requestAnimationFrame(tick); return; }
      const cycle = speed; // seconds per full journey
      const pos = (elapsed % cycle) / cycle; // 0..1
      // Reset crossed flag on new cycle
      if (pos < 0.1 && crossedRef.current) crossedRef.current = false;
      // Fire crossing at 0.5 (border midpoint)
      if (pos >= 0.5 && !crossedRef.current) {
        crossedRef.current = true;
        if (onCross) onCross(label);
      }
      setT(pos);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [delay, speed]);

  // Bridge goes from x=26% to x=74% (MX side → US side)
  const x = 26 + t * 48;
  const atBorder = t > 0.45 && t < 0.55;

  return (
    <g style={{ transition: 'none' }}>
      {/* trail */}
      <line x1={26} y1="50" x2={x} y2="50"
            stroke="var(--cruz-green-2)"
            strokeWidth={active ? 0.6 : 0.3}
            opacity={active ? 0.5 : 0.2}
            strokeDasharray="1 1"/>
      {/* truck */}
      <g transform={`translate(${x} 50)`}>
        <rect x="-1.6" y="-0.9" width="2.6" height="1.8" rx="0.2"
              fill={active ? 'var(--cruz-green-2)' : 'var(--cruz-fg-4)'}
              opacity={atBorder ? 1 : 0.9}>
          {atBorder && (
            <animate attributeName="opacity" values="0.8;1;0.8" dur="0.5s" repeatCount="indefinite"/>
          )}
        </rect>
        <rect x="1" y="-0.7" width="0.7" height="1.4" rx="0.1"
              fill={active ? 'var(--cruz-green-3)' : 'var(--cruz-fg-5)'}/>
        {/* label — only for active, counter-flip so text reads correctly */}
        {active && (
          <g transform="scale(-1 1)">
            <text x="0" y="-1.8" fontSize="1.6" fontFamily="var(--cruz-font-mono)"
                  fill="var(--cruz-green-2)" textAnchor="middle" letterSpacing="0.3">
              {label}
            </text>
          </g>
        )}
      </g>
    </g>
  );
};

/* —— The hero panel ——————————————————————————————————————————————— */
const LiveBorderHero = () => {
  const [crossings, setCrossings] = useBorderState(38);
  const [lastEvent, setLastEvent] = useBorderState(null);
  const [flash, setFlash] = useBorderState(false);
  const [clock, setClock] = useBorderState(() => {
    const d = new Date();
    return d.toTimeString().slice(0, 8);
  });

  useBorderEffect(() => {
    const h = setInterval(() => {
      setClock(new Date().toTimeString().slice(0, 8));
    }, 1000);
    return () => clearInterval(h);
  }, []);

  const handleCrossing = (truckLabel) => {
    setCrossings(c => c + 1);
    setFlash(true);
    const ts = new Date().toTimeString().slice(0, 8);
    const evt = { label: truckLabel, ts, id: Date.now() };
    setLastEvent(evt);
    setTimeout(() => setFlash(false), 1200);
    // Broadcast globally
    if (window.__cruzCrossingBus) {
      window.__cruzCrossingBus.emit(evt);
    }
  };

  return (
    <section
      className="cruz-card"
      style={{
        position: 'relative',
        padding: 0,
        marginBottom: 'var(--cruz-s-8)',
        borderColor: flash ? 'var(--cruz-green-2)' : 'var(--cruz-line-2)',
        boxShadow: flash
          ? '0 0 0 1px var(--cruz-green-2), 0 0 60px -10px var(--cruz-green-glow), var(--cruz-shadow-2)'
          : 'var(--cruz-shadow-2)',
        transition: 'all 700ms var(--cruz-ease-out)',
        overflow: 'hidden',
      }}
    >
      {/* header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 24px 14px', borderBottom: '1px solid var(--cruz-line-1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--cruz-green-2)', boxShadow: '0 0 10px var(--cruz-green-glow)', animation: 'portalDotPulse 2.4s ease-in-out infinite' }}/>
            <span style={{ position: 'absolute', inset: -4, borderRadius: 999, border: '1px solid var(--cruz-green-2)', opacity: 0.5, animation: 'portalPing 2.4s ease-out infinite' }}/>
          </span>
          <span style={{
            fontFamily: 'var(--cruz-font-display)', fontSize: 14, fontWeight: 500,
            letterSpacing: '0.24em', color: 'var(--cruz-fg-1)',
          }}>
            LA FRONTERA EN VIVO
          </span>
          <span style={{
            fontFamily: 'var(--cruz-font-mono)', fontSize: 10, letterSpacing: '0.18em',
            color: 'var(--cruz-fg-5)', textTransform: 'uppercase',
          }}>
            · Laredo II · {clock}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Stat label="CRUCES HOY" value={crossings} live/>
          <Stat label="EN PUENTE" value="3"/>
          <Stat label="ESPERA" value="14m"/>
          <Stat label="CBP" value="OK" accent/>
        </div>
      </div>

      {/* the map */}
      <div style={{ position: 'relative', background: 'var(--cruz-ink-0)' }}>
        <svg viewBox="0 0 100 60" width="100%" height="auto"
             preserveAspectRatio="xMidYMid meet"
             style={{ display: 'block', aspectRatio: '100/60' }}>
          <defs>
            <linearGradient id="rioGrande" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--cruz-green-2)" stopOpacity="0.08"/>
              <stop offset="0.5" stopColor="var(--cruz-green-2)" stopOpacity="0.14"/>
              <stop offset="1" stopColor="var(--cruz-green-2)" stopOpacity="0.08"/>
            </linearGradient>
            <linearGradient id="mxLand" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="var(--cruz-ink-2)" stopOpacity="0"/>
              <stop offset="1" stopColor="var(--cruz-ink-2)" stopOpacity="0.6"/>
            </linearGradient>
            <linearGradient id="usLand" x1="1" x2="0" y1="0" y2="0">
              <stop offset="0" stopColor="var(--cruz-ink-2)" stopOpacity="0"/>
              <stop offset="1" stopColor="var(--cruz-ink-2)" stopOpacity="0.6"/>
            </linearGradient>
            <pattern id="gridDots" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.15" fill="var(--cruz-line-2)"/>
            </pattern>
          </defs>

          {/* dot grid */}
          <rect x="0" y="0" width="100" height="60" fill="url(#gridDots)"/>

          {/* MX side land mass (right when viewing south-to-north, but here left=MX/south, right=US/north) */}
          {/* Actually let's do MX=right, US=left to match Nuevo Laredo (MX) → Laredo TX (US) north-bound */}
          {/* Mexico land (right side) */}
          <path d="M 56 0 L 100 0 L 100 60 L 56 60 Q 54 45, 55 30 Q 56 15, 56 0 Z"
                fill="url(#mxLand)"/>
          {/* US land (left side) */}
          <path d="M 0 0 L 44 0 Q 45 15, 46 30 Q 47 45, 45 60 L 0 60 Z"
                fill="url(#usLand)"/>

          {/* Rio Grande — meandering river between them */}
          <path d="M 56 0 Q 54 15, 55 30 Q 56 45, 54 60 L 46 60 Q 47 45, 46 30 Q 45 15, 44 0 Z"
                fill="url(#rioGrande)"/>
          <path d="M 50 0 Q 48 15, 49.5 30 Q 50.5 45, 49 60"
                fill="none" stroke="var(--cruz-green-3)" strokeWidth="0.25" opacity="0.5"/>

          {/* Border line — dashed, subtle */}
          <line x1="50" y1="2" x2="50" y2="58"
                stroke="var(--cruz-green-2)" strokeWidth="0.15"
                strokeDasharray="0.6 1.2" opacity="0.65"/>

          {/* Laredo II bridge — horizontal band across the river */}
          <rect x="26" y="48.5" width="48" height="3" rx="0.3"
                fill="var(--cruz-ink-3)" stroke="var(--cruz-line-1)" strokeWidth="0.1"/>
          {/* Bridge lane divider */}
          <line x1="26" y1="50" x2="74" y2="50"
                stroke="var(--cruz-line-2)" strokeWidth="0.12"
                strokeDasharray="0.8 0.4"/>
          {/* Bridge supports */}
          {[32, 44, 56, 68].map(x => (
            <rect key={x} x={x - 0.3} y="51.2" width="0.6" height="2"
                  fill="var(--cruz-line-2)" opacity="0.4"/>
          ))}

          {/* Checkpoint structures */}
          {/* MX checkpoint (right) */}
          <g transform="translate(76 47)">
            <rect x="-2" y="0" width="4" height="4" rx="0.3"
                  fill="var(--cruz-ink-3)" stroke="var(--cruz-green-3)" strokeWidth="0.12"/>
            <text x="0" y="-0.6" fontSize="1.6" fontFamily="var(--cruz-font-mono)"
                  fill="var(--cruz-fg-4)" textAnchor="middle" letterSpacing="0.2">SAT</text>
          </g>
          {/* US checkpoint (left) */}
          <g transform="translate(24 47)">
            <rect x="-2" y="0" width="4" height="4" rx="0.3"
                  fill="var(--cruz-ink-3)" stroke="var(--cruz-green-3)" strokeWidth="0.12"/>
            <text x="0" y="-0.6" fontSize="1.6" fontFamily="var(--cruz-font-mono)"
                  fill="var(--cruz-fg-4)" textAnchor="middle" letterSpacing="0.2">CBP</text>
          </g>

          {/* Labels */}
          <text x="86" y="15" fontSize="2.4" fontFamily="var(--cruz-font-display)"
                fill="var(--cruz-fg-3)" textAnchor="middle" letterSpacing="0.2">
            NUEVO LAREDO
          </text>
          <text x="86" y="18" fontSize="1.4" fontFamily="var(--cruz-font-mono)"
                fill="var(--cruz-fg-5)" textAnchor="middle" letterSpacing="0.3">
            TAMAULIPAS · MX
          </text>
          <text x="14" y="15" fontSize="2.4" fontFamily="var(--cruz-font-display)"
                fill="var(--cruz-fg-3)" textAnchor="middle" letterSpacing="0.2">
            LAREDO
          </text>
          <text x="14" y="18" fontSize="1.4" fontFamily="var(--cruz-font-mono)"
                fill="var(--cruz-fg-5)" textAnchor="middle" letterSpacing="0.3">
            TEXAS · US
          </text>

          <text x="50" y="6" fontSize="1.4" fontFamily="var(--cruz-font-mono)"
                fill="var(--cruz-fg-4)" textAnchor="middle" letterSpacing="0.4">
            RÍO BRAVO / GRANDE
          </text>
          <text x="50" y="56.5" fontSize="1.3" fontFamily="var(--cruz-font-mono)"
                fill="var(--cruz-green-3)" textAnchor="middle" letterSpacing="0.4">
            PUENTE INTERNACIONAL · LAREDO II
          </text>

          {/* Warehouse on US side (where entradas arrive) */}
          <g transform="translate(6 34)">
            <rect x="-3" y="-1.5" width="6" height="3" rx="0.2"
                  fill="var(--cruz-ink-3)" stroke="var(--cruz-green-3)" strokeWidth="0.15" strokeOpacity="0.6"/>
            <text x="0" y="0.6" fontSize="1.1" fontFamily="var(--cruz-font-mono)"
                  fill="var(--cruz-fg-3)" textAnchor="middle" letterSpacing="0.2">ALMACÉN</text>
          </g>

          {/* Three trucks — note bridge is now right-to-left (MX→US) so we need to flip direction */}
          {/* BridgeTruck goes left→right; we want MX(right) → US(left), so flip by mapping */}
          {/* Instead, render with transform to flip each truck horizontally */}
          <g transform="translate(100 0) scale(-1 1)">
            <BridgeTruck delay={0}  speed={15} label="TX-4829" onCross={handleCrossing} active/>
            <BridgeTruck delay={5}  speed={15} label="TX-4831" onCross={() => {}} />
            <BridgeTruck delay={10} speed={15} label="TX-4832" onCross={() => {}} />
          </g>

          {/* Flash overlay when crossing */}
          {flash && (
            <rect x="0" y="0" width="100" height="60"
                  fill="var(--cruz-green-2)" opacity="0.04">
              <animate attributeName="opacity" values="0.12;0;0" dur="1.2s" fill="freeze"/>
            </rect>
          )}
        </svg>

        {/* Crossing event toast overlay */}
        {lastEvent && flash && (
          <div style={{
            position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--cruz-ink-3)',
            border: '1px solid var(--cruz-green-2)',
            borderRadius: 'var(--cruz-r-pill)',
            padding: '8px 18px',
            fontFamily: 'var(--cruz-font-mono)', fontSize: 11, letterSpacing: '0.18em',
            color: 'var(--cruz-green-2)', textTransform: 'uppercase',
            boxShadow: '0 0 20px var(--cruz-green-glow), 0 8px 24px rgba(0,0,0,0.5)',
            animation: 'crossToastIn 400ms var(--cruz-ease-out) both',
            whiteSpace: 'nowrap',
          }}>
            ✓ {lastEvent.label} · cruzó Laredo II · {lastEvent.ts}
          </div>
        )}
      </div>

      {/* bottom telemetry strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
        borderTop: '1px solid var(--cruz-line-1)',
      }}>
        <TelemetryCell
          label="ACTIVO"
          value="TX-4829"
          sub="28,450 kg · autopartes · Monterrey → Laredo TX"
          accent
        />
        <TelemetryCell
          label="PEDIMENTO"
          value="240-2601-6002104"
          sub="A1 · firmado 14:18 · Renato Z."
        />
        <TelemetryCell
          label="TEMPERATURA"
          value="24°C"
          sub="cielo despejado · viento 12 km/h NE"
        />
        <TelemetryCell
          label="TIEMPO DE CRUCE"
          value="8 min"
          sub="promedio hoy · -4m vs ayer"
        />
      </div>

      {/* CTA strip — opens the full pedimento theater */}
      <button
        onClick={() => window.__cruzOpenTheater && window.__cruzOpenTheater('240-2601-6002104')}
        style={{
          width: '100%', padding: '12px 24px',
          background: 'var(--cruz-ink-0)',
          borderTop: '1px solid var(--cruz-line-1)', borderLeft: 0, borderRight: 0, borderBottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer',
          fontFamily: 'var(--cruz-font-mono)', fontSize: 10, letterSpacing: '0.22em',
          color: 'var(--cruz-fg-3)', textTransform: 'uppercase',
          transition: 'background 300ms',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--cruz-ink-1)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--cruz-ink-0)'}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--cruz-green-2)' }}>▸</span>
          VER FLUJO COMPLETO DEL PEDIMENTO
          <span style={{ color: 'var(--cruz-fg-5)' }}>· 240-2601-6002104 · 5 ETAPAS · 00:04:18</span>
        </span>
        <span style={{ color: 'var(--cruz-fg-4)' }}>REPRODUCIR →</span>
      </button>
    </section>
  );
};

/* —— Stat pill in header ————————————————————————————————————————— */
const Stat = ({ label, value, live, accent }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
    <span style={{
      fontFamily: 'var(--cruz-font-mono)', fontSize: 9, letterSpacing: '0.22em',
      color: 'var(--cruz-fg-5)', textTransform: 'uppercase',
    }}>
      {label}
    </span>
    <span style={{
      fontFamily: live ? 'var(--cruz-font-mono)' : 'var(--cruz-font-display)',
      fontSize: live ? 16 : 18, fontWeight: live ? 500 : 400,
      color: accent ? 'var(--cruz-green-2)' : 'var(--cruz-fg-1)',
      letterSpacing: live ? '0.04em' : '0.02em',
      fontVariantNumeric: 'tabular-nums',
      textShadow: accent ? '0 0 12px var(--cruz-green-glow)' : 'none',
    }}>
      {value}
    </span>
  </div>
);

/* —— Bottom telemetry row cell —————————————————————————————————————— */
const TelemetryCell = ({ label, value, sub, accent }) => (
  <div style={{
    padding: '14px 20px',
    borderRight: '1px solid var(--cruz-line-1)',
    display: 'flex', flexDirection: 'column', gap: 4,
  }}>
    <div style={{
      fontFamily: 'var(--cruz-font-mono)', fontSize: 9, letterSpacing: '0.22em',
      color: 'var(--cruz-fg-5)', textTransform: 'uppercase',
    }}>
      {label}
    </div>
    <div style={{
      fontFamily: 'var(--cruz-font-display)', fontSize: 18, fontWeight: 400,
      color: accent ? 'var(--cruz-green-2)' : 'var(--cruz-fg-1)',
      letterSpacing: '0.01em',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {value}
    </div>
    <div style={{
      fontFamily: 'var(--cruz-font-sans)', fontSize: 11,
      color: 'var(--cruz-fg-4)', lineHeight: 1.3,
    }}>
      {sub}
    </div>
  </div>
);

Object.assign(window, { LiveBorderHero });
