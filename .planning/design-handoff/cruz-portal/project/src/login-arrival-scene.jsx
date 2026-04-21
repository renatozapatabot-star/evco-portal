/* PORTAL — Arrival at Aduana 240 (Still Life).
   A quiet frozen dusk: sky gradient, scattered stars, silhouetted mountains,
   a road receding to the vanishing point. Zero animation.
   The only living things on this screen are the card + portal above it.
*/
const ArrivalScene = () => {
  // Deterministic "random" star field (seeded from index so layout is stable across renders)
  const stars = React.useMemo(() => {
    const out = [];
    for (let i = 0; i < 140; i++) {
      const x = (i * 197 + 53) % 1600;
      const y = ((i * 131 + 17) % 440) + 10;
      const r = 0.6 + ((i * 7) % 10) / 10 * 0.9;
      const op = 0.35 + ((i * 13) % 100) / 100 * 0.5;
      const warm = i % 11 === 0;
      out.push({ x, y, r, op, warm });
    }
    return out;
  }, []);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden',
      background: `linear-gradient(to bottom,
        oklch(0.10 0.03 210) 0%,
        oklch(0.13 0.045 200) 38%,
        oklch(0.10 0.03 198) 68%,
        oklch(0.07 0.02 200) 100%)`,
    }}>
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"
           style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <radialGradient id="skyglow" cx="50%" cy="68%" r="50%">
            <stop offset="0%" stopColor="oklch(0.24 0.09 195)" stopOpacity="0.42"/>
            <stop offset="50%" stopColor="oklch(0.14 0.05 200)" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="transparent"/>
          </radialGradient>
          <linearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.12 0.03 200)"/>
            <stop offset="100%" stopColor="oklch(0.07 0.015 200)"/>
          </linearGradient>
        </defs>

        {/* Atmospheric glow behind mountains */}
        <rect x="-100" y="0" width="1800" height="900" fill="url(#skyglow)"/>

        {/* Stars — fixed, no twinkle */}
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r}
                  fill={s.warm ? 'oklch(0.78 0.08 195)' : 'oklch(0.85 0.03 200)'}
                  opacity={s.op}/>
        ))}

        {/* One bright "evening star" near the horizon — anchor for the eye */}
        <circle cx="1140" cy="360" r="1.8" fill="oklch(0.92 0.08 195)" opacity="0.95"/>
        <circle cx="1140" cy="360" r="5" fill="oklch(0.7 0.1 195)" opacity="0.18"/>

        {/* Mountain range — two layers, silhouette */}
        <g opacity="0.92">
          <path d="M -50 520
                   Q 80 470, 180 485 T 380 460
                   Q 460 445, 560 465 T 760 450
                   Q 840 438, 940 460 T 1140 448
                   Q 1220 432, 1320 452 T 1520 440
                   L 1650 450 L 1650 600 L -50 600 Z"
                fill="oklch(0.11 0.028 200)"/>
          <path d="M -50 560
                   Q 120 520, 260 540 T 520 515
                   Q 640 500, 800 525 T 1060 505
                   Q 1200 492, 1360 518 T 1650 500
                   L 1650 620 L -50 620 Z"
                fill="oklch(0.09 0.022 200)"/>
        </g>

        {/* ROAD — quiet perspective */}
        <g>
          <path d="M 380 900 L 1220 900 L 920 620 L 680 620 Z" fill="url(#roadGrad)"/>
          <path d="M 380 900 L 680 620" stroke="oklch(0.32 0.07 195)" strokeWidth="1" opacity="0.4"/>
          <path d="M 1220 900 L 920 620" stroke="oklch(0.32 0.07 195)" strokeWidth="1" opacity="0.4"/>
          {/* Static dashes — 6 of them, fixed positions */}
          {Array.from({ length: 6 }).map((_, i) => {
            const t = i / 6;
            const y = 620 + t * 280;
            const width = 4 + t * 10;
            const height = 14 + t * 32;
            const op = 0.3 + t * 0.4;
            return (
              <rect key={i} x={800 - width / 2} y={y - height / 2}
                    width={width} height={height}
                    fill="oklch(0.55 0.12 195)" opacity={op}/>
            );
          })}
        </g>
      </svg>

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, oklch(0.05 0.015 200 / 0.6) 100%)',
      }}/>
    </div>
  );
};

Object.assign(window, { ArrivalScene });
