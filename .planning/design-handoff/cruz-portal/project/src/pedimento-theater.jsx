/* =========================================================================
   CRUZ — PedimentoTheater
   ---------------------------------------------------------------------------
   A full-viewport overlay that plays the pedimento lifecycle as a cinematic
   4-minute condensed sequence. The signature "this is what CRUZ does" moment.

   5 acts:
     01 CREACIÓN      — operator uploads invoice, SAT validates RFC/IMMEX
     02 CLASIFICACIÓN — AI classifies 14 fractions, suggests T-MEC
     03 FIRMA         — electronic signature, SAT receives pedimento
     04 PAGO          — DTA/IVA computed, bank confirms
     05 LIBERACIÓN    — semáforo verde, truck authorized to cross

   Controls: play/pause, stage chips (click to jump), esc to close.
   The whole thing auto-advances; user can scrub stages.

   Exposes:
     window.__cruzOpenTheater(pedimentoId)
     <PedimentoTheater/> (mounted globally at app level)
   ========================================================================= */

const { useState: _thUseState, useEffect: _thUseEffect, useRef: _thUseRef, useMemo: _thUseMemo } = React;
// Reuse the short names locally so the component body reads clean.
const useState = _thUseState;
const useEffect = _thUseEffect;
const useRef = _thUseRef;
const useMemo = _thUseMemo;

const TheaterAct01 = ({ t }) => {
  // t: 0..1 within this act
  const validated = t > 0.35;
  const lines = [
    { label: 'RFC EMISOR',       value: 'TYM891102-H78', ok: t > 0.08 },
    { label: 'RFC RECEPTOR',     value: 'CRZ190315-4K2', ok: t > 0.14 },
    { label: 'FOLIO FISCAL UUID', value: 'A7F9-8E3B-…D94C', ok: t > 0.22 },
    { label: 'MONEDA · USD',     value: '184,920.40',   ok: t > 0.28 },
    { label: 'IMMEX VIGENTE',    value: 'PROGRAMA 4829',  ok: t > 0.34 },
    { label: 'INCOTERM',         value: 'FOB LAREDO',   ok: t > 0.40 },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 40, width: '100%', maxWidth: 1100, alignItems: 'center' }}>
      {/* Left: simulated document */}
      <div style={{ position: 'relative', aspectRatio: '0.77', background: 'var(--cruz-ink-1)', border: '1px solid var(--cruz-line-2)', borderRadius: 'var(--cruz-r-2)', padding: 24, overflow: 'hidden' }}>
        <div style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 8, letterSpacing: '0.22em', color: 'var(--cruz-fg-5)', textTransform: 'uppercase', marginBottom: 6 }}>
          FACTURA COMERCIAL · CFDI 4.0
        </div>
        <div style={{ fontFamily: 'var(--cruz-font-display)', fontSize: 18, color: 'var(--cruz-fg-1)', letterSpacing: '0.02em', marginBottom: 18 }}>
          TYM-INV-2025-00482
        </div>
        {[1,2,3,4,5,6,7,8,9,10,11].map(i => (
          <div key={i} style={{
            height: 6, marginBottom: 6, borderRadius: 2,
            background: 'var(--cruz-line-1)',
            width: `${60 + (i * 17) % 35}%`,
            opacity: t > (i * 0.04) ? 1 : 0.35,
            transition: 'opacity 300ms',
          }}/>
        ))}
        {/* Scanning laser */}
        <div style={{
          position: 'absolute', left: 0, right: 0,
          height: 2, background: 'linear-gradient(to right, transparent, var(--cruz-green-2), transparent)',
          boxShadow: '0 0 16px var(--cruz-green-glow)',
          top: `${t * 100}%`,
          transition: 'top 50ms linear',
          opacity: t < 1 ? 0.9 : 0,
        }}/>
        {validated && (
          <div style={{
            position: 'absolute', bottom: 16, right: 16,
            padding: '6px 12px', background: 'var(--cruz-ink-3)',
            border: '1px solid var(--cruz-green-2)', borderRadius: 'var(--cruz-r-pill)',
            fontFamily: 'var(--cruz-font-mono)', fontSize: 9, letterSpacing: '0.22em',
            color: 'var(--cruz-green-2)', textTransform: 'uppercase',
            boxShadow: '0 0 14px var(--cruz-green-glow)',
          }}>✓ CFDI válido</div>
        )}
      </div>
      {/* Right: validation checklist */}
      <div>
        <div style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 10, letterSpacing: '0.28em', color: 'var(--cruz-fg-4)', textTransform: 'uppercase', marginBottom: 16 }}>
          VALIDACIÓN SAT · VUCEM
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lines.map((l, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 16px',
              background: l.ok ? 'color-mix(in oklch, var(--cruz-green-2) 6%, var(--cruz-ink-1))' : 'var(--cruz-ink-1)',
              border: '1px solid ' + (l.ok ? 'var(--cruz-green-3)' : 'var(--cruz-line-1)'),
              borderRadius: 'var(--cruz-r-2)',
              transition: 'all 400ms var(--cruz-ease-out)',
            }}>
              <span style={{
                width: 14, height: 14, borderRadius: 999,
                display: 'grid', placeItems: 'center',
                background: l.ok ? 'var(--cruz-green-2)' : 'transparent',
                border: '1px solid ' + (l.ok ? 'var(--cruz-green-2)' : 'var(--cruz-line-3)'),
                color: 'var(--cruz-ink-0)', fontSize: 10, fontWeight: 700,
              }}>{l.ok ? '✓' : ''}</span>
              <span style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 10, letterSpacing: '0.22em', color: 'var(--cruz-fg-5)', textTransform: 'uppercase', flex: 1 }}>
                {l.label}
              </span>
              <span style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 12, color: l.ok ? 'var(--cruz-fg-1)' : 'var(--cruz-fg-4)' }}>
                {l.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TheaterAct02 = ({ t }) => {
  // AI classification — 14 fractions, reveal one by one
  const fractions = [
    { sku: 'BRK-8403-A', desc: 'Balatas cerámicas ensambladas',       code: '8708.30.01', cls: 0.98 },
    { sku: 'BRK-8403-B', desc: 'Pastillas freno delanteras',          code: '8708.30.01', cls: 0.97 },
    { sku: 'FLT-2274',   desc: 'Filtro aceite motor 5L',              code: '8421.23.02', cls: 0.94 },
    { sku: 'SPK-EU-8',   desc: 'Bujía iridio electrodo fino',         code: '8511.10.01', cls: 0.96 },
    { sku: 'SNS-O2-V2',  desc: 'Sensor oxígeno banda ancha',          code: '9026.20.01', cls: 0.91 },
    { sku: 'ALT-14V',    desc: 'Alternador 14V 120A remanufact.',     code: '8511.50.01', cls: 0.93 },
    { sku: 'RAD-CU-4X',  desc: 'Radiador cobre 4 hileras',            code: '8708.91.99', cls: 0.89 },
    { sku: 'HSE-VAC-3',  desc: 'Manguera vacío silicón reforzada',    code: '4009.22.99', cls: 0.88 },
    { sku: 'BLT-M10-G',  desc: 'Tornillería M10 grado 8.8',           code: '7318.15.09', cls: 0.92 },
    { sku: 'GSK-HD-V8',  desc: 'Junta culata multicapa V8',           code: '8484.10.01', cls: 0.87 },
    { sku: 'CLT-DRY',    desc: 'Kit embrague tipo seco',              code: '8708.93.01', cls: 0.95 },
    { sku: 'TRB-K04',    desc: 'Turbocargador K04 reman.',            code: '8414.59.99', cls: 0.94 },
    { sku: 'WHP-FE-17',  desc: 'Rin aluminio 17" diseño estrella',    code: '8708.70.03', cls: 0.90 },
    { sku: 'HDL-ASM',    desc: 'Faro LED ensamble completo',          code: '8512.20.02', cls: 0.93 },
  ];
  const n = Math.floor(t * fractions.length);
  return (
    <div style={{ width: '100%', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 10, letterSpacing: '0.28em', color: 'var(--cruz-fg-4)', textTransform: 'uppercase', marginBottom: 6 }}>
            CLASIFICACIÓN ARANCELARIA · CRUZ IA
          </div>
          <div style={{ fontFamily: 'var(--cruz-font-display)', fontSize: 22, fontWeight: 300, color: 'var(--cruz-fg-1)', letterSpacing: '0.01em' }}>
            Asignando fracciones a {fractions.length} SKUs · T-MEC preferencial
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 28, color: 'var(--cruz-green-2)', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 12px var(--cruz-green-glow)' }}>
            {String(n).padStart(2, '0')}<span style={{ color: 'var(--cruz-fg-5)' }}>/{fractions.length}</span>
          </span>
        </div>
      </div>

      <div style={{
        border: '1px solid var(--cruz-line-2)', borderRadius: 'var(--cruz-r-2)',
        overflow: 'hidden', background: 'var(--cruz-ink-1)',
      }}>
        {/* header row */}
        <div style={{
          display: 'grid', gridTemplateColumns: '100px 1fr 120px 100px 60px',
          gap: 16, padding: '10px 20px',
          borderBottom: '1px solid var(--cruz-line-1)',
          fontFamily: 'var(--cruz-font-mono)', fontSize: 9, letterSpacing: '0.22em', color: 'var(--cruz-fg-5)', textTransform: 'uppercase',
        }}>
          <span>SKU</span>
          <span>DESCRIPCIÓN</span>
          <span>FRACCIÓN</span>
          <span>CONFIANZA</span>
          <span></span>
        </div>
        {fractions.map((f, i) => {
          const revealed = i < n;
          const justNow = i === n - 1;
          return (
            <div key={f.sku} style={{
              display: 'grid', gridTemplateColumns: '100px 1fr 120px 100px 60px',
              gap: 16, padding: '12px 20px',
              borderBottom: i < fractions.length - 1 ? '1px solid var(--cruz-line-1)' : 'none',
              opacity: revealed ? 1 : 0.25,
              background: justNow ? 'color-mix(in oklch, var(--cruz-green-2) 6%, transparent)' : 'transparent',
              transition: 'all 400ms var(--cruz-ease-out)',
              fontFamily: 'var(--cruz-font-mono)', fontSize: 11,
            }}>
              <span style={{ color: 'var(--cruz-fg-2)' }}>{f.sku}</span>
              <span style={{ color: 'var(--cruz-fg-3)', fontFamily: 'var(--cruz-font-sans)' }}>{f.desc}</span>
              <span style={{ color: revealed ? 'var(--cruz-green-2)' : 'var(--cruz-fg-5)' }}>{revealed ? f.code : '—'}</span>
              <span style={{ color: 'var(--cruz-fg-3)' }}>{revealed ? `${Math.round(f.cls * 100)}%` : '—'}</span>
              <span style={{ color: revealed ? 'var(--cruz-green-2)' : 'var(--cruz-fg-5)', fontSize: 10 }}>
                {revealed ? 'T-MEC' : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TheaterAct03 = ({ t }) => {
  // Electronic signature — fingerprint scan + hash generation
  const progress = Math.min(1, t * 1.2);
  const hashChars = '0123456789ABCDEF';
  const hashLen = 48;
  const hashStr = React.useMemo(() => {
    let s = '';
    for (let i = 0; i < hashLen; i++) s += hashChars[Math.floor((i * 17 + 3) % hashChars.length)];
    return s;
  }, []);
  const revealedHash = hashStr.slice(0, Math.floor(progress * hashLen));
  const scrambling = hashStr.slice(Math.floor(progress * hashLen));
  const signed = t > 0.75;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 60, alignItems: 'center', width: '100%', maxWidth: 1100 }}>
      {/* Left: fingerprint ring */}
      <div style={{ position: 'relative', width: 380, height: 380, display: 'grid', placeItems: 'center' }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <defs>
            <radialGradient id="fpGlow">
              <stop offset="0%" stopColor="var(--cruz-green-2)" stopOpacity="0.3"/>
              <stop offset="60%" stopColor="var(--cruz-green-2)" stopOpacity="0.08"/>
              <stop offset="100%" stopColor="var(--cruz-green-2)" stopOpacity="0"/>
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#fpGlow)"/>
          {/* concentric rings */}
          {[44, 38, 32, 26, 20].map((r, i) => (
            <circle key={r} cx="50" cy="50" r={r}
              fill="none" stroke="var(--cruz-green-2)" strokeWidth="0.15" opacity={0.15 + i * 0.1}/>
          ))}
          {/* fingerprint arcs */}
          {[14, 18, 22, 26, 30, 34].map((r, i) => {
            const dash = r * 1.5;
            const offset = -progress * dash * 2;
            return (
              <circle key={r} cx="50" cy="50" r={r}
                fill="none"
                stroke={progress > i * 0.15 ? 'var(--cruz-green-2)' : 'var(--cruz-line-3)'}
                strokeWidth="0.4"
                strokeDasharray={`${dash * 0.6} ${dash * 0.4}`}
                strokeDashoffset={offset}
                opacity={progress > i * 0.15 ? 0.8 : 0.3}
                style={{ transition: 'all 400ms' }}
                transform={`rotate(${i * 60} 50 50)`}
              />
            );
          })}
          {/* scanning line */}
          {!signed && (
            <line x1="20" x2="80" y1={20 + progress * 60} y2={20 + progress * 60}
              stroke="var(--cruz-green-2)" strokeWidth="0.3" opacity="0.8"
              style={{ filter: 'drop-shadow(0 0 3px var(--cruz-green-glow))' }}/>
          )}
          {/* center check when signed */}
          {signed && (
            <g>
              <circle cx="50" cy="50" r="10" fill="var(--cruz-green-2)" opacity="0.9"/>
              <path d="M 45 50 L 49 54 L 56 46" stroke="var(--cruz-ink-0)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </g>
          )}
        </svg>
      </div>
      {/* Right: signature details */}
      <div>
        <div style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 10, letterSpacing: '0.28em', color: 'var(--cruz-fg-4)', textTransform: 'uppercase', marginBottom: 6 }}>
          FIRMA ELECTRÓNICA AVANZADA · SAT
        </div>
        <div style={{ fontFamily: 'var(--cruz-font-display)', fontSize: 32, fontWeight: 300, color: 'var(--cruz-fg-1)', letterSpacing: '0.01em', marginBottom: 4 }}>
          {signed ? 'Pedimento firmado' : 'Firmando pedimento…'}
        </div>
        <div style={{ fontFamily: 'var(--cruz-font-sans)', fontSize: 14, color: 'var(--cruz-fg-4)', marginBottom: 28 }}>
          Renato Zárate · Agente aduanal 4829 · e.firma vigente al 2028
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row label="CERTIFICADO" value="A0101…4K2.cer" done={progress > 0.2}/>
          <Row label="LLAVE PRIVADA" value="•••• •••• •••• 8C4F" done={progress > 0.4}/>
          <Row label="HASH SHA-256" value={revealedHash + (scrambling ? scrambling.split('').map(()=> hashChars[Math.floor(Math.random()*16)]).join('').slice(0,8) : '')} done={signed} mono/>
          <Row label="SELLO SAT" value={signed ? 'a7f9-8e3b-c204-d94c' : '…esperando'} done={signed}/>
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value, done, mono }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '160px 1fr 20px',
    gap: 16, alignItems: 'center',
    padding: '10px 16px',
    background: done ? 'color-mix(in oklch, var(--cruz-green-2) 5%, var(--cruz-ink-1))' : 'var(--cruz-ink-1)',
    border: '1px solid ' + (done ? 'var(--cruz-green-3)' : 'var(--cruz-line-1)'),
    borderRadius: 'var(--cruz-r-2)',
    transition: 'all 400ms',
  }}>
    <span style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 9, letterSpacing: '0.22em', color: 'var(--cruz-fg-5)', textTransform: 'uppercase' }}>{label}</span>
    <span style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 11, color: done ? 'var(--cruz-fg-1)' : 'var(--cruz-fg-4)', letterSpacing: mono ? '0.05em' : '0.02em', wordBreak: 'break-all' }}>{value}</span>
    <span style={{ color: done ? 'var(--cruz-green-2)' : 'var(--cruz-fg-5)', fontSize: 13, textAlign: 'right' }}>{done ? '✓' : '·'}</span>
  </div>
);

const TheaterAct04 = ({ t }) => {
  // Payment computation
  const items = [
    { k: 'VALOR EN ADUANA',    v: 3192184.52, mxn: true },
    { k: 'DTA · 0.176%',       v: 5618.24,    mxn: true },
    { k: 'IVA 16%',            v: 0,          mxn: true, note: 'diferido por IMMEX' },
    { k: 'IGI',                v: 0,          mxn: true, note: 'T-MEC · preferencial' },
    { k: 'PREVALIDACIÓN',      v: 290,        mxn: true },
  ];
  const total = items.reduce((a, b) => a + b.v, 0);
  const paid = t > 0.7;
  const display = Math.min(1, t * 1.1);
  return (
    <div style={{ width: '100%', maxWidth: 900 }}>
      <div style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 10, letterSpacing: '0.28em', color: 'var(--cruz-fg-4)', textTransform: 'uppercase', marginBottom: 8 }}>
        DETERMINACIÓN DE CONTRIBUCIONES · PAGO
      </div>
      <div style={{ fontFamily: 'var(--cruz-font-display)', fontSize: 32, fontWeight: 300, color: 'var(--cruz-fg-1)', marginBottom: 28 }}>
        Banamex · transferencia SPEI
      </div>

      <div style={{
        border: '1px solid var(--cruz-line-2)', borderRadius: 'var(--cruz-r-3)',
        overflow: 'hidden', background: 'var(--cruz-ink-1)',
      }}>
        {items.map((it, i) => {
          const shown = display > (i + 1) * (0.9 / items.length);
          return (
            <div key={it.k} style={{
              display: 'grid', gridTemplateColumns: '1fr 220px 140px',
              gap: 16, padding: '16px 24px',
              borderBottom: '1px solid var(--cruz-line-1)',
              opacity: shown ? 1 : 0.3,
              transition: 'opacity 300ms',
            }}>
              <span style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 10, letterSpacing: '0.22em', color: 'var(--cruz-fg-4)', textTransform: 'uppercase' }}>{it.k}</span>
              <span style={{ fontFamily: 'var(--cruz-font-sans)', fontSize: 12, color: 'var(--cruz-fg-5)' }}>{it.note || ''}</span>
              <span style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 14, color: it.v === 0 ? 'var(--cruz-fg-4)' : 'var(--cruz-fg-1)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {shown ? 'MXN ' + it.v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
              </span>
            </div>
          );
        })}
        {/* total */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 140px',
          gap: 16, padding: '20px 24px',
          background: paid ? 'color-mix(in oklch, var(--cruz-green-2) 8%, var(--cruz-ink-2))' : 'var(--cruz-ink-2)',
          borderTop: '1px solid ' + (paid ? 'var(--cruz-green-2)' : 'var(--cruz-line-2)'),
          transition: 'all 500ms',
        }}>
          <span style={{ fontFamily: 'var(--cruz-font-display)', fontSize: 14, letterSpacing: '0.12em', color: 'var(--cruz-fg-2)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 14 }}>
            TOTAL A PAGAR
            {paid && <span style={{ padding: '3px 10px', background: 'var(--cruz-green-2)', color: 'var(--cruz-ink-0)', borderRadius: 'var(--cruz-r-pill)', fontFamily: 'var(--cruz-font-mono)', fontSize: 9, letterSpacing: '0.22em' }}>✓ PAGADO</span>}
          </span>
          <span style={{ fontFamily: 'var(--cruz-font-display)', fontSize: 28, fontWeight: 400, color: 'var(--cruz-fg-1)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', textShadow: paid ? '0 0 16px var(--cruz-green-glow)' : 'none' }}>
            ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {paid && (
        <div style={{
          marginTop: 20, padding: 14,
          fontFamily: 'var(--cruz-font-mono)', fontSize: 10, letterSpacing: '0.22em',
          color: 'var(--cruz-green-2)', textTransform: 'uppercase',
          animation: 'portalFadeUp 500ms var(--cruz-ease-out) both',
        }}>
          ✓ REFERENCIA BANAMEX 87429034 · CONFIRMADO 14:17:48
        </div>
      )}
    </div>
  );
};

const TheaterAct05 = ({ t }) => {
  // Semáforo + truck crossing
  const semaphoreOn = t > 0.2;
  const truckMove = Math.min(1, Math.max(0, (t - 0.4) * 1.8));
  return (
    <div style={{ width: '100%', maxWidth: 1100, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 10, letterSpacing: '0.28em', color: 'var(--cruz-fg-4)', textTransform: 'uppercase', marginBottom: 8 }}>
          MÓDULO SELECTIVO AUTOMATIZADO · ADUANA NUEVO LAREDO
        </div>
        <div style={{ fontFamily: 'var(--cruz-font-display)', fontSize: 40, fontWeight: 300, color: 'var(--cruz-fg-1)', letterSpacing: '-0.01em', marginBottom: 8 }}>
          {semaphoreOn ? 'Semáforo verde' : 'Evaluando…'}
        </div>
        <div style={{ fontFamily: 'var(--cruz-font-sans)', fontSize: 15, color: 'var(--cruz-fg-4)', maxWidth: 560, margin: '0 auto', lineHeight: 1.5 }}>
          El pedimento <span style={{ color: 'var(--cruz-fg-2)', fontFamily: 'var(--cruz-font-mono)' }}>240-2601-6002104</span> ha sido liberado. El transportista está autorizado para cruzar a territorio de los Estados Unidos.
        </div>
      </div>

      {/* giant semáforo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 20, padding: '18px 28px', background: 'var(--cruz-ink-1)', border: '1px solid var(--cruz-line-2)', borderRadius: 999 }}>
          {['red', 'amber', 'green'].map((c) => {
            const on = semaphoreOn && c === 'green';
            const color = c === 'red' ? '#E1443A' : c === 'amber' ? '#E6A834' : 'var(--cruz-green-2)';
            return (
              <div key={c} style={{
                width: 54, height: 54, borderRadius: 999,
                background: on ? color : 'var(--cruz-ink-3)',
                boxShadow: on ? `0 0 36px ${color}, 0 0 72px ${color}` : `inset 0 0 0 1px var(--cruz-line-2)`,
                transition: 'all 600ms',
              }}/>
            );
          })}
        </div>

        {/* mini crossing animation — appears once semáforo is green */}
        <div style={{ position: 'relative', width: 560, height: 80, opacity: semaphoreOn ? 1 : 0.3, transition: 'opacity 600ms' }}>
          <svg viewBox="0 0 200 40" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            {/* Bridge rails */}
            <line x1="10" x2="190" y1="24" y2="24" stroke="var(--cruz-line-2)" strokeWidth="0.6"/>
            <line x1="10" x2="190" y1="28" y2="28" stroke="var(--cruz-line-1)" strokeWidth="0.3"/>
            {/* MX and US markers */}
            <text x="14" y="36" fontSize="2.6" fontFamily="var(--cruz-font-mono)" fill="var(--cruz-fg-5)" letterSpacing="0.4">MX · NVO LAREDO</text>
            <text x="186" y="36" fontSize="2.6" fontFamily="var(--cruz-font-mono)" fill="var(--cruz-fg-5)" letterSpacing="0.4" textAnchor="end">LAREDO · TX</text>
            {/* Border line */}
            <line x1="100" x2="100" y1="20" y2="32" stroke="var(--cruz-green-2)" strokeWidth="0.3" strokeDasharray="0.8 0.8" opacity="0.5"/>
            {/* Truck */}
            <g transform={`translate(${20 + truckMove * 160} 22)`}>
              <rect x="-4" y="-3" width="8" height="4" fill="var(--cruz-fg-2)" rx="0.3"/>
              <rect x="-5" y="-1" width="2" height="2" fill="var(--cruz-fg-3)" rx="0.2"/>
              <text x="0" y="-4" fontSize="2" fontFamily="var(--cruz-font-mono)" fill="var(--cruz-green-2)" textAnchor="middle" letterSpacing="0.3">TX-4829</text>
            </g>
          </svg>
        </div>
      </div>

      {t > 0.9 && (
        <div style={{
          padding: '16px 28px',
          background: 'var(--cruz-ink-1)',
          border: '1px solid var(--cruz-green-2)',
          borderRadius: 'var(--cruz-r-pill)',
          display: 'flex', alignItems: 'center', gap: 18,
          boxShadow: '0 0 40px var(--cruz-green-glow)',
          animation: 'portalFadeUp 500ms var(--cruz-ease-out) both',
        }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--cruz-green-2)', animation: 'portalDotPulse 2s infinite' }}/>
          <span style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 12, letterSpacing: '0.22em', color: 'var(--cruz-green-2)', textTransform: 'uppercase' }}>
            PEDIMENTO LIBERADO · 14:18:03 · 4:18 TOTAL
          </span>
        </div>
      )}
    </div>
  );
};

/* ========================================================================= */

const ACTS = [
  { id: '01', name: 'CREACIÓN',      sub: 'Factura y validación SAT · VUCEM',        dur: 10000, render: (t) => <TheaterAct01 t={t}/> },
  { id: '02', name: 'CLASIFICACIÓN', sub: 'CRUZ IA · 14 fracciones · T-MEC',         dur: 12000, render: (t) => <TheaterAct02 t={t}/> },
  { id: '03', name: 'FIRMA',         sub: 'e.firma agente aduanal · sello SAT',      dur: 8000,  render: (t) => <TheaterAct03 t={t}/> },
  { id: '04', name: 'PAGO',          sub: 'DTA · IVA diferido · SPEI Banamex',       dur: 8000,  render: (t) => <TheaterAct04 t={t}/> },
  { id: '05', name: 'LIBERACIÓN',    sub: 'Semáforo verde · aduana Nuevo Laredo',    dur: 10000, render: (t) => <TheaterAct05 t={t}/> },
];

const PedimentoTheater = () => {
  const [open, setOpen] = useState(false);
  const [pedId, setPedId] = useState(null);
  const [actIdx, setActIdx] = useState(0);
  const [actT, setActT] = useState(0);       // 0..1 within act
  const [playing, setPlaying] = useState(true);
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);

  useEffect(() => {
    window.__cruzOpenTheater = (id) => {
      setPedId(id);
      setActIdx(0);
      setActT(0);
      setPlaying(true);
      setOpen(true);
    };
    return () => { delete window.__cruzOpenTheater; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
      if (e.key === 'ArrowRight') setActIdx(i => Math.min(ACTS.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setActIdx(i => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Animation loop
  useEffect(() => {
    if (!open || !playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
      return;
    }
    const tick = (ts) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;
      setActT(prev => {
        const d = ACTS[actIdx].dur;
        const next = prev + dt / d;
        if (next >= 1) {
          if (actIdx < ACTS.length - 1) {
            setActIdx(a => a + 1);
            return 0;
          } else {
            setPlaying(false);
            return 1;
          }
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [open, playing, actIdx]);

  // Reset actT when stage is manually changed
  useEffect(() => { setActT(0); lastTsRef.current = null; }, [actIdx]);

  if (!open) return null;
  const act = ACTS[actIdx];
  const overallT = (actIdx + actT) / ACTS.length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'color-mix(in oklch, var(--cruz-ink-0) 95%, transparent)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'grid', gridTemplateRows: 'auto 1fr auto',
      height: '100vh', overflow: 'hidden',
      animation: 'theaterIn 500ms var(--cruz-ease-out) both',
    }}>
      {/* Header */}
      <header style={{
        padding: '20px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--cruz-line-1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--cruz-green-2)', boxShadow: '0 0 10px var(--cruz-green-glow)', animation: 'portalDotPulse 2.4s infinite' }}/>
          <span style={{ fontFamily: 'var(--cruz-font-display)', fontSize: 13, fontWeight: 400, letterSpacing: '0.28em', color: 'var(--cruz-fg-1)', textTransform: 'uppercase' }}>
            Flujo del pedimento
          </span>
          <span style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 11, letterSpacing: '0.16em', color: 'var(--cruz-fg-5)' }}>
            · {pedId}
          </span>
        </div>
        <button onClick={() => setOpen(false)} style={{
          width: 36, height: 36, display: 'grid', placeItems: 'center',
          background: 'transparent', border: '1px solid var(--cruz-line-2)', borderRadius: 999,
          cursor: 'pointer', color: 'var(--cruz-fg-3)', fontSize: 18,
        }}>×</button>
      </header>

      {/* Stage */}
      <main style={{
        display: 'grid', placeItems: 'center', padding: '24px 40px',
        overflow: 'auto', position: 'relative', minHeight: 0,
      }}>
        <div key={actIdx} style={{ animation: 'theaterActIn 500ms var(--cruz-ease-out) both', width: '100%', display: 'grid', placeItems: 'center' }}>
          {act.render(actT)}
        </div>
      </main>

      {/* Transport bar */}
      <footer style={{
        padding: '20px 40px 24px',
        borderTop: '1px solid var(--cruz-line-1)',
        background: 'color-mix(in oklch, var(--cruz-ink-1) 60%, transparent)',
      }}>
        {/* Stage chips */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ACTS.length}, 1fr)`, gap: 8, marginBottom: 16 }}>
          {ACTS.map((a, i) => {
            const done = i < actIdx;
            const current = i === actIdx;
            const progress = done ? 1 : (current ? actT : 0);
            return (
              <button key={a.id} onClick={() => setActIdx(i)} style={{
                position: 'relative',
                padding: '12px 14px',
                background: current ? 'var(--cruz-ink-2)' : 'var(--cruz-ink-1)',
                border: '1px solid ' + (current ? 'var(--cruz-green-2)' : done ? 'var(--cruz-green-3)' : 'var(--cruz-line-1)'),
                borderRadius: 'var(--cruz-r-2)',
                textAlign: 'left',
                cursor: 'pointer', overflow: 'hidden',
                transition: 'all 300ms',
              }}>
                {/* progress fill */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'color-mix(in oklch, var(--cruz-green-2) 8%, transparent)',
                  width: `${progress * 100}%`, transition: 'width 200ms',
                }}/>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 11, color: current ? 'var(--cruz-green-2)' : done ? 'var(--cruz-fg-3)' : 'var(--cruz-fg-5)', letterSpacing: '0.12em' }}>
                    {a.id}
                  </span>
                  <div>
                    <div style={{ fontFamily: 'var(--cruz-font-display)', fontSize: 12, letterSpacing: '0.18em', color: current ? 'var(--cruz-fg-1)' : done ? 'var(--cruz-fg-2)' : 'var(--cruz-fg-4)', textTransform: 'uppercase' }}>
                      {a.name}
                    </div>
                    <div style={{ fontFamily: 'var(--cruz-font-sans)', fontSize: 10, color: 'var(--cruz-fg-5)', marginTop: 2 }}>
                      {a.sub}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Play/pause + scrubber */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button onClick={() => setPlaying(p => !p)} style={{
            width: 40, height: 40, borderRadius: 999, display: 'grid', placeItems: 'center',
            background: 'var(--cruz-green-2)', color: 'var(--cruz-ink-0)',
            border: 'none', cursor: 'pointer', fontSize: 14,
            boxShadow: '0 0 16px var(--cruz-green-glow)',
          }}>{playing ? '❚❚' : '▶'}</button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 10, color: 'var(--cruz-fg-4)', letterSpacing: '0.12em' }}>
              {String(actIdx + 1).padStart(2, '0')} / 05
            </span>
            <div style={{ flex: 1, height: 2, background: 'var(--cruz-line-1)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${overallT * 100}%`, background: 'var(--cruz-green-2)',
                boxShadow: '0 0 10px var(--cruz-green-glow)',
              }}/>
            </div>
            <span style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 10, color: 'var(--cruz-fg-5)', letterSpacing: '0.12em' }}>
              ESC · SPACE · ← →
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

Object.assign(window, { PedimentoTheater });
