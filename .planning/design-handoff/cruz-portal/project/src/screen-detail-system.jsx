/* CRUZ — Pedimento detail screen */

const DetailScreen = ({ onBack }) => {
  const tabs = ['Resumen', 'Partidas', 'Documentos', 'Pagos', 'Trazabilidad'];
  const [tab, setTab] = useState('Resumen');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cruz-ink-0)', position: 'relative' }}>
      <WorldMesh opacity={0.05}/>
      {/* Teal accent line above top nav — matches login */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 21,
        height: 2,
        background: 'linear-gradient(to right, transparent 0%, var(--cruz-green-2) 20%, var(--cruz-green-2) 80%, transparent 100%)',
        boxShadow: '0 0 12px var(--cruz-green-glow)',
        opacity: 0.85,
      }}/>
      <header style={{
        height: 'var(--cruz-topbar-h)', padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 16,
        borderBottom: '1px solid var(--cruz-line-1)',
        background: 'color-mix(in oklch, var(--cruz-ink-0) 85%, transparent)',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <button onClick={onBack} className="cruz-btn cruz-btn--ghost cruz-btn--sm">
          <Icon name="arrowLeft" size={13}/> Volver
        </button>
        <span className="cruz-eyebrow">DASHBOARD / EMBARQUES / PEDIMENTO</span>
        <div style={{ flex: 1 }}/>
        <Badge variant="live" dot>EN VIVO</Badge>
        <button className="cruz-btn cruz-btn--ghost cruz-btn--sm"><Icon name="download" size={13}/> PDF</button>
        <button className="cruz-btn cruz-btn--ghost cruz-btn--sm"><Icon name="copy" size={13}/> Copiar</button>
      </header>

      <div style={{ padding: '40px 40px 80px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Hero */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32, alignItems: 'flex-end', marginBottom: 40 }}>
          <div>
            <div className="cruz-eyebrow" style={{ marginBottom: 12 }}>PEDIMENTO · A1 IMPORTACIÓN DEFINITIVA</div>
            <h1 style={{
              fontFamily: 'var(--cruz-font-mono)', fontWeight: 400,
              fontSize: 64, lineHeight: 1, letterSpacing: '-0.02em',
              color: 'var(--cruz-fg-1)', margin: 0,
            }}>
              240-2601-<span style={{ color: 'var(--cruz-green-2)' }}>6002104</span>
            </h1>
            {/* Stage progress spine — the live pulse across pedimento lifecycle */}
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 0, maxWidth: 560 }}>
              {['Creación', 'Validación', 'Pago', 'Firma', 'Liberación'].map((stage, i, arr) => {
                const done = i < 4; const live = i === 4;
                return (
                  <React.Fragment key={stage}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{
                        width: 9, height: 9, borderRadius: 999,
                        background: live ? 'var(--cruz-green-2)' : (done ? 'var(--cruz-green-2)' : 'var(--cruz-ink-3)'),
                        border: '1px solid ' + (live || done ? 'var(--cruz-green-2)' : 'var(--cruz-line-3)'),
                        boxShadow: live ? '0 0 0 4px var(--cruz-green-glow)' : 'none',
                        animation: live ? 'pedPulse 2s ease-in-out infinite' : 'none',
                      }}/>
                      <span style={{
                        fontFamily: 'var(--cruz-font-mono)', fontSize: 8, letterSpacing: '0.2em',
                        color: live ? 'var(--cruz-green-2)' : (done ? 'var(--cruz-fg-3)' : 'var(--cruz-fg-5)'),
                        textTransform: 'uppercase', whiteSpace: 'nowrap',
                      }}>{stage}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{
                        flex: 1, height: 1, margin: '0 6px',
                        background: done ? 'var(--cruz-green-3)' : 'var(--cruz-line-2)',
                        opacity: done ? 0.6 : 1,
                        marginBottom: 18,
                      }}/>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Badge variant="live" dot>LIBERADO · SEMÁFORO VERDE</Badge>
              <Badge variant="info">IMMEX VIGENTE</Badge>
              <Badge>A1 · DEFINITIVO</Badge>
              <Badge>T-MEC</Badge>
            </div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1,
            background: 'var(--cruz-line-1)',
            border: '1px solid var(--cruz-line-1)',
            borderRadius: 'var(--cruz-r-3)', overflow: 'hidden',
          }}>
            {[
              { k: 'VALOR ADUANA', v: 'USD 184,920.40', sub: 'MXN 3,192,184.52' },
              { k: 'IMPUESTOS', v: 'MXN 0.00', sub: 'T-MEC · preferencial' },
              { k: 'PESO', v: '12,480 kg', sub: '18 bultos · 2 tarimas' },
              { k: 'FRACCIONES', v: '14', sub: 'todas clasificadas' },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--cruz-ink-1)', padding: '16px 20px' }}>
                <div className="cruz-eyebrow">{s.k}</div>
                <div className="cruz-num" style={{ fontSize: 20, color: 'var(--cruz-fg-1)', marginTop: 6, fontFamily: 'var(--cruz-font-mono)' }}>{s.v}</div>
                <div className="cruz-meta" style={{ marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: '1px solid var(--cruz-line-1)',
          marginBottom: 32,
        }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '14px 20px', fontSize: 'var(--cruz-fs-sm)',
              color: tab === t ? 'var(--cruz-fg-1)' : 'var(--cruz-fg-4)',
              borderBottom: tab === t ? '1px solid var(--cruz-green-2)' : '1px solid transparent',
              marginBottom: -1, position: 'relative',
              boxShadow: tab === t ? '0 1px 8px var(--cruz-green-glow)' : 'none',
              transition: 'color 200ms',
            }}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'Resumen' && <TabResumen/>}
        {tab === 'Partidas' && <TabPartidas/>}
        {tab === 'Documentos' && <TabDocumentos/>}
        {tab === 'Pagos' && <TabPagos/>}
        {tab === 'Trazabilidad' && <TabTrazabilidad/>}
      </div>
      <style>{`
        @keyframes pedScan {
          0%   { top: -10%; opacity: 0; }
          12%  { opacity: 0.9; }
          50%  { top: 50%; opacity: 0.9; }
          88%  { opacity: 0.9; }
          100% { top: 110%; opacity: 0; }
        }
        @keyframes pedPulse {
          0%, 100% { box-shadow: 0 0 0 4px var(--cruz-green-glow); }
          50%      { box-shadow: 0 0 0 7px color-mix(in oklch, var(--cruz-green-2) 10%, transparent); }
        }
      `}</style>
    </div>
  );
};

/* ---- Tab: Resumen — timeline + route + fractions summary ---- */
const TabResumen = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 40 }}>
    <div>
      <div className="cruz-eyebrow" style={{ marginBottom: 20 }}>TRAZABILIDAD · 7 EVENTOS</div>
      <div style={{ position: 'relative', paddingLeft: 28 }}>
        <div style={{ position: 'absolute', left: 9, top: 6, bottom: 6, width: 1, background: 'var(--cruz-line-2)' }}/>
        {[
          { t: 'Liberación inmediata', s: '14 abr · 10:42', d: 'Semáforo verde. Salida de recinto autorizada.', live: true },
          { t: 'Reconocimiento aduanero', s: '14 abr · 10:28', d: 'No aplica. Selectividad automática.', ok: true },
          { t: 'Pago efectuado', s: '14 abr · 09:51', d: 'Línea de captura E8340482 · BBVA', ok: true },
          { t: 'Pedimento firmado', s: '14 abr · 09:12', d: 'Renato Zapata III · FIEL RZG...', ok: true },
          { t: 'Documentos integrados', s: '13 abr · 17:40', d: '7 documentos · factura, BL, CO T-MEC' },
          { t: 'Arribo a patio Laredo', s: '13 abr · 14:22', d: 'Trailer 48ft · placas TX 3J-NR1' },
          { t: 'Aviso previo', s: '12 abr · 09:05', d: 'EVCO abrió solicitud de importación' },
        ].map((e, i) => (
          <div key={i} style={{ position: 'relative', paddingBottom: 22 }}>
            <span style={{
              position: 'absolute', left: -23, top: 5, width: 10, height: 10, borderRadius: 999,
              background: e.live ? 'var(--cruz-green-2)' : 'var(--cruz-ink-3)',
              border: '1px solid ' + (e.live ? 'var(--cruz-green-2)' : 'var(--cruz-line-3)'),
              boxShadow: e.live ? '0 0 0 4px var(--cruz-green-glow)' : 'none',
            }}/>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ color: 'var(--cruz-fg-1)', fontSize: 'var(--cruz-fs-md)' }}>{e.t}</span>
              <span className="cruz-meta">{e.s}</span>
            </div>
            <div style={{ color: 'var(--cruz-fg-3)', fontSize: 'var(--cruz-fs-sm)', marginTop: 4 }}>{e.d}</div>
          </div>
        ))}
      </div>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="cruz-card" style={{ padding: 20 }}>
        <div className="cruz-eyebrow" style={{ marginBottom: 14 }}>RUTA</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--cruz-fs-sm)' }}>
          {[
            ['Origen', 'Houston, TX'],
            ['Cruce', 'Nuevo Laredo II · 240'],
            ['Destino', 'Querétaro, MX'],
            ['Transporte', 'Terrestre · CTPAT'],
            ['Transportista', 'Fletes Suárez'],
          ].map(([k, v], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="cruz-meta">{k}</span>
              <span style={{ color: 'var(--cruz-fg-1)' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="cruz-card" style={{ padding: 20 }}>
        <div className="cruz-eyebrow" style={{ marginBottom: 14 }}>PARTES · TOP FRACCIONES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['3923.30.01', 'Envases plásticos · PET', 'USD 82,120'],
            ['3923.90.99', 'Artículos transporte plástico', 'USD 41,200'],
            ['3926.90.99', 'Otras manufacturas plástico', 'USD 38,700'],
            ['8480.71.02', 'Moldes para plástico', 'USD 22,900'],
          ].map(([f, n, v], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 'var(--cruz-fs-sm)' }}>
              <div>
                <div className="cruz-num" style={{ color: 'var(--cruz-fg-1)', fontFamily: 'var(--cruz-font-mono)' }}>{f}</div>
                <div className="cruz-meta" style={{ marginTop: 2 }}>{n}</div>
              </div>
              <span className="cruz-num" style={{ fontFamily: 'var(--cruz-font-mono)', color: 'var(--cruz-fg-1)' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/* ---- Tab: Partidas — line-item table with mini bar treemap of value distribution ---- */
const TabPartidas = () => {
  const items = [
    { n: 1, f: '3923.30.01', d: 'Envases PET · 500ml transparente', qty: '48,000 pz', peso: '4,820 kg', v: 82120, pct: 44.4 },
    { n: 2, f: '3923.90.99', d: 'Artículos transporte (tapas, asas)', qty: '120,400 pz', peso: '2,100 kg', v: 41200, pct: 22.3 },
    { n: 3, f: '3926.90.99', d: 'Otras manufacturas plástico', qty: '14,200 pz', peso: '1,980 kg', v: 38700, pct: 20.9 },
    { n: 4, f: '8480.71.02', d: 'Moldes de inyección × 4', qty: '4 pz', peso: '3,580 kg', v: 22900, pct: 12.4 },
  ];
  return (
    <div>
      {/* Treemap of value */}
      <div className="cruz-eyebrow" style={{ marginBottom: 14 }}>DISTRIBUCIÓN DE VALOR · 14 PARTIDAS EN 4 FRACCIONES</div>
      <div style={{ display: 'flex', height: 64, gap: 2, borderRadius: 'var(--cruz-r-2)', overflow: 'hidden', marginBottom: 32 }}>
        {items.map((it, i) => (
          <div key={i} style={{
            flex: it.pct, minWidth: 0,
            background: i === 0 ? 'var(--cruz-green-2)' : `color-mix(in oklch, var(--cruz-green-2) ${60 - i*15}%, var(--cruz-ink-3))`,
            padding: '10px 14px', color: i === 0 ? 'var(--cruz-ink-0)' : 'var(--cruz-fg-1)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div className="cruz-num" style={{ fontSize: 10, letterSpacing: '0.1em', opacity: 0.8 }}>{it.f}</div>
            <div className="cruz-num" style={{ fontSize: 14 }}>{it.pct}%</div>
          </div>
        ))}
      </div>

      {/* Line item table */}
      <table className="cruz-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: 50 }}>#</th>
            <th>Fracción</th>
            <th>Descripción</th>
            <th className="num" style={{ textAlign: 'right' }}>Cantidad</th>
            <th className="num" style={{ textAlign: 'right' }}>Peso</th>
            <th className="num" style={{ textAlign: 'right' }}>Valor USD</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.n}>
              <td className="num" style={{ color: 'var(--cruz-fg-4)' }}>{String(it.n).padStart(2, '0')}</td>
              <td><span className="cruz-num" style={{ color: 'var(--cruz-fg-1)' }}>{it.f}</span></td>
              <td style={{ color: 'var(--cruz-fg-2)' }}>{it.d}</td>
              <td className="num" style={{ textAlign: 'right' }}>{it.qty}</td>
              <td className="num" style={{ textAlign: 'right' }}>{it.peso}</td>
              <td className="num" style={{ textAlign: 'right' }}>{it.v.toLocaleString()}</td>
              <td style={{ textAlign: 'right' }}>
                <Badge variant="live">T-MEC</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40, marginTop: 20, paddingRight: 16 }}>
        <div>
          <div className="cruz-eyebrow">TOTAL PESO</div>
          <div className="cruz-num" style={{ color: 'var(--cruz-fg-1)', fontSize: 20, marginTop: 4 }}>12,480 kg</div>
        </div>
        <div>
          <div className="cruz-eyebrow">TOTAL VALOR</div>
          <div className="cruz-num" style={{ color: 'var(--cruz-green-2)', fontSize: 20, marginTop: 4 }}>USD 184,920.40</div>
        </div>
      </div>
    </div>
  );
};

/* ---- Tab: Documentos — grid of document cards with validation status ---- */
const TabDocumentos = () => {
  const docs = [
    { k: 'FACT', n: 'INV-HTX-88412', t: 'Factura comercial', sz: '142 KB', ok: true, checks: ['Firma electrónica', 'Datos en pedimento', 'Total coincide'] },
    { k: 'BL',   n: 'MSKU-7710-4921', t: 'Bill of lading', sz: '88 KB', ok: true, checks: ['Consignatario', 'Marca y número', 'Peso bruto'] },
    { k: 'CO',   n: 'T-MEC/2024/00482', t: 'Certificado T-MEC', sz: '96 KB', ok: true, checks: ['Vigencia', 'Criterio origen', 'Descripción'] },
    { k: 'PCK',  n: 'PK-HTX-88412', t: 'Packing list', sz: '44 KB', ok: true, checks: ['Cajas', 'Marcas', 'Peso'] },
    { k: 'MSDS', n: 'MSDS-PET-R1', t: 'Hoja de seguridad', sz: '2.1 MB', ok: true, checks: ['16 secciones', 'Idioma', 'Vigencia'] },
    { k: 'NOM',  n: 'NOM-050-SCFI', t: 'Etiquetado NOM', sz: '1.3 MB', ok: true, checks: ['Datos comerciales', 'Leyendas', 'Idioma'] },
    { k: 'VALR', n: 'DECL-VAL-41', t: 'Manifestación de valor', sz: '68 KB', ok: true, checks: ['Incoterm', 'Método', 'Vinculación'] },
  ];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
        <div className="cruz-eyebrow">EXPEDIENTE · 7 DE 7 INTEGRADOS</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="cruz-btn cruz-btn--ghost cruz-btn--sm"><Icon name="download" size={13}/> Descargar ZIP</button>
          <button className="cruz-btn cruz-btn--ghost cruz-btn--sm"><Icon name="copy" size={13}/> Compartir</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {docs.map((d, i) => (
          <div key={i} className="cruz-card" style={{ padding: 18, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{
                width: 40, height: 52, background: 'var(--cruz-ink-3)',
                border: '1px solid var(--cruz-line-2)', borderRadius: 3,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--cruz-font-mono)', fontSize: 9, letterSpacing: '0.1em',
                color: 'var(--cruz-green-2)', fontWeight: 600,
                position: 'relative',
              }}>
                {d.k}
                <div style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, background: 'var(--cruz-ink-1)', borderLeft: '1px solid var(--cruz-line-2)', borderBottom: '1px solid var(--cruz-line-2)' }}/>
              </div>
              <Badge variant="live" dot>VÁLIDO</Badge>
            </div>
            <div style={{ color: 'var(--cruz-fg-1)', fontSize: 'var(--cruz-fs-md)', marginBottom: 2 }}>{d.t}</div>
            <div className="cruz-num" style={{ color: 'var(--cruz-fg-4)', fontSize: 11, letterSpacing: '0.05em' }}>{d.n} · {d.sz}</div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {d.checks.map((c, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--cruz-fg-3)' }}>
                  <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 5.5 L4 8 L9 2" fill="none" stroke="var(--cruz-green-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {c}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---- Tab: Pagos — ledger with waterfall to total ---- */
const TabPagos = () => {
  const lines = [
    { k: 'Valor en aduana',     v: 184920.40, color: 'var(--cruz-fg-1)', note: 'Base gravable' },
    { k: 'IGI',                 v: 0,          color: 'var(--cruz-green-2)', note: 'T-MEC · preferencial 0%' },
    { k: 'DTA',                 v: 1293.44,    color: 'var(--cruz-fg-2)', note: '0.8% sobre valor' },
    { k: 'Prevalidación',       v: 320.00,     color: 'var(--cruz-fg-2)', note: 'Cuota fija' },
    { k: 'IVA (16%)',           v: 29794.23,   color: 'var(--cruz-fg-2)', note: 'Sobre valor + DTA + IGI' },
    { k: 'Crédito IVA IMMEX',   v: -29794.23,  color: 'var(--cruz-green-2)', note: 'Certificación IVA/IEPS · Fracción A' },
  ];
  const total = lines.reduce((a, b) => a + b.v, 0);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 40 }}>
      <div>
        <div className="cruz-eyebrow" style={{ marginBottom: 20 }}>WATERFALL · CÁLCULO DE CONTRIBUCIONES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {lines.map((ln, i) => {
            const isNeg = ln.v < 0;
            const isZero = ln.v === 0;
            return (
              <div key={i} style={{
                padding: '18px 0', borderBottom: '1px solid var(--cruz-line-1)',
                display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 20, alignItems: 'baseline',
              }}>
                <div>
                  <div style={{ color: 'var(--cruz-fg-1)', fontSize: 'var(--cruz-fs-md)' }}>{ln.k}</div>
                  <div className="cruz-meta" style={{ marginTop: 2 }}>{ln.note}</div>
                </div>
                <div style={{ position: 'relative', height: 4, background: 'var(--cruz-line-1)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: isNeg ? 'auto' : '0',
                    right: isNeg ? '0' : 'auto',
                    width: `${Math.min(100, Math.abs(ln.v) / 2000)}%`,
                    background: ln.color, opacity: 0.8,
                  }}/>
                </div>
                <div className="cruz-num" style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 16, color: ln.color, minWidth: 140, textAlign: 'right' }}>
                  {isZero ? '— 0.00' : `${isNeg ? '−' : '+'} ${Math.abs(ln.v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                </div>
              </div>
            );
          })}
          <div style={{ padding: '24px 0', display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 20, alignItems: 'baseline' }}>
            <div style={{ color: 'var(--cruz-fg-1)', fontSize: 'var(--cruz-fs-lg)', fontWeight: 500 }}>Total a pagar</div>
            <div/>
            <div className="cruz-num" style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 28, color: 'var(--cruz-green-2)', minWidth: 140, textAlign: 'right', textShadow: '0 0 24px var(--cruz-green-glow)' }}>
              MXN {total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="cruz-card" style={{ padding: 24, background: 'var(--cruz-ink-2)' }}>
          <div className="cruz-eyebrow" style={{ marginBottom: 14 }}>LÍNEA DE CAPTURA</div>
          <div className="cruz-num" style={{ fontSize: 22, color: 'var(--cruz-fg-1)', letterSpacing: '0.08em', fontFamily: 'var(--cruz-font-mono)' }}>E8 340 482</div>
          <div style={{ marginTop: 14, padding: 12, background: 'var(--cruz-ink-0)', borderRadius: 'var(--cruz-r-2)', border: '1px solid var(--cruz-line-1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="cruz-meta">Banco</span>
              <span style={{ color: 'var(--cruz-fg-1)', fontSize: 13 }}>BBVA México</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="cruz-meta">Pagado</span>
              <span className="cruz-num" style={{ color: 'var(--cruz-fg-1)', fontSize: 13 }}>14 abr · 09:51</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="cruz-meta">Referencia</span>
              <span className="cruz-num" style={{ color: 'var(--cruz-fg-1)', fontSize: 13 }}>0124-7788-4</span>
            </div>
          </div>
          <Badge variant="live" dot style={{ marginTop: 14 }}>SALDADO</Badge>
        </div>

        <div className="cruz-card" style={{ padding: 20 }}>
          <div className="cruz-eyebrow" style={{ marginBottom: 12 }}>AHORRO T-MEC</div>
          <div className="cruz-num" style={{ fontSize: 28, color: 'var(--cruz-green-2)', fontFamily: 'var(--cruz-font-mono)' }}>USD 18,492</div>
          <div className="cruz-meta" style={{ marginTop: 6 }}>10% arancel evitado bajo tratado</div>
        </div>
      </div>
    </div>
  );
};

/* ---- Tab: Trazabilidad — full-width map + detailed event log ---- */
const TabTrazabilidad = () => (
  <div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 40 }}>
      {/* Journey rail visual */}
      <div className="cruz-card" style={{ padding: 28, background: 'var(--cruz-ink-2)' }}>
        <div className="cruz-eyebrow" style={{ marginBottom: 24 }}>RUTA · HOUSTON → QUERÉTARO</div>
        <div style={{ position: 'relative', height: 140 }}>
          <svg width="100%" height="140" viewBox="0 0 400 140" preserveAspectRatio="none">
            {/* curved path */}
            <path d="M 20 100 Q 120 60 200 70 Q 280 80 380 40"
                  fill="none" stroke="var(--cruz-line-2)" strokeWidth="1" strokeDasharray="2 3"/>
            <path d="M 20 100 Q 120 60 200 70"
                  fill="none" stroke="var(--cruz-green-2)" strokeWidth="2" filter="drop-shadow(0 0 6px var(--cruz-green-glow))"/>
            {/* nodes */}
            {[
              { x: 20, y: 100, label: 'Houston TX', sub: 'origen', done: true },
              { x: 200, y: 70, label: 'Laredo 240', sub: 'cruce', done: true, live: true },
              { x: 380, y: 40, label: 'Querétaro', sub: 'destino', done: false },
            ].map((n, i) => (
              <g key={i}>
                <circle cx={n.x} cy={n.y} r={n.live ? 7 : 5}
                        fill={n.done ? 'var(--cruz-green-2)' : 'var(--cruz-ink-3)'}
                        stroke={n.done ? 'var(--cruz-green-2)' : 'var(--cruz-line-3)'} strokeWidth="1.5"/>
                {n.live && <circle cx={n.x} cy={n.y} r="12" fill="none" stroke="var(--cruz-green-2)" strokeWidth="1" opacity="0.4">
                  <animate attributeName="r" values="7;18;7" dur="2s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite"/>
                </circle>}
                <text x={n.x} y={n.y - 14} textAnchor="middle" fill="var(--cruz-fg-1)" fontSize="10" fontFamily="var(--cruz-font-sans)">{n.label}</text>
                <text x={n.x} y={n.y + 20} textAnchor="middle" fill="var(--cruz-fg-5)" fontSize="7" fontFamily="var(--cruz-font-mono)" letterSpacing="0.15em">{n.sub.toUpperCase()}</text>
              </g>
            ))}
          </svg>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 11 }}>
          <div><div className="cruz-eyebrow">DISTANCIA</div><div className="cruz-num" style={{ color: 'var(--cruz-fg-1)', marginTop: 4 }}>1,847 km</div></div>
          <div><div className="cruz-eyebrow">TIEMPO TOTAL</div><div className="cruz-num" style={{ color: 'var(--cruz-fg-1)', marginTop: 4 }}>58 h 12 min</div></div>
          <div><div className="cruz-eyebrow">ETA DESTINO</div><div className="cruz-num" style={{ color: 'var(--cruz-green-2)', marginTop: 4 }}>15 abr · 22:00</div></div>
        </div>
      </div>

      {/* Stakeholders */}
      <div className="cruz-card" style={{ padding: 28 }}>
        <div className="cruz-eyebrow" style={{ marginBottom: 24 }}>ACTORES · 5 PARTES INVOLUCRADAS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { k: 'IMPORTADOR', n: 'Plastimex S.A. de C.V.', rfc: 'PLA-980415-H12' },
            { k: 'EXPORTADOR', n: 'Houston Polymer LLC', rfc: 'US EIN 74-3098124' },
            { k: 'AGENTE', n: 'Renato Zapata III', rfc: 'Patente 3596' },
            { k: 'TRANSPORTISTA', n: 'Fletes Suárez', rfc: 'FSU-020314-BH8' },
            { k: 'RECINTO', n: 'Nuevo Laredo II', rfc: 'Aduana 240' },
          ].map((a, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 14, borderBottom: i < 4 ? '1px solid var(--cruz-line-1)' : 'none' }}>
              <div>
                <div className="cruz-eyebrow" style={{ fontSize: 9 }}>{a.k}</div>
                <div style={{ color: 'var(--cruz-fg-1)', fontSize: 13, marginTop: 4 }}>{a.n}</div>
              </div>
              <div className="cruz-num" style={{ color: 'var(--cruz-fg-4)', fontSize: 10, letterSpacing: '0.05em' }}>{a.rfc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Full event log */}
    <div className="cruz-eyebrow" style={{ marginBottom: 20 }}>BITÁCORA COMPLETA · 14 EVENTOS DE SISTEMA</div>
    <div style={{ position: 'relative', paddingLeft: 28 }}>
      <div style={{ position: 'absolute', left: 9, top: 6, bottom: 6, width: 1, background: 'var(--cruz-line-2)' }}/>
      {[
        { t: 'Liberación inmediata', s: '14 abr · 10:42:18', d: 'Salida de recinto autorizada. Semáforo verde. Operador: VUCEM/SAT.', live: true },
        { t: 'Reconocimiento aduanero', s: '14 abr · 10:28:04', d: 'No aplica — selectividad automática determinó semáforo verde.', ok: true },
        { t: 'Selectividad ejecutada', s: '14 abr · 10:27:59', d: 'Algoritmo SAT · criterio T-MEC · match = 0.98', ok: true },
        { t: 'Pedimento validado VUCEM', s: '14 abr · 10:12:00', d: 'Sin observaciones. Folio 240-VUC-88412-R.', ok: true },
        { t: 'Pago efectuado', s: '14 abr · 09:51:22', d: 'Línea E8340482 · BBVA México · ref. 0124-7788-4', ok: true },
        { t: 'Pedimento firmado', s: '14 abr · 09:12:44', d: 'Renato Zapata III · FIEL RZG860412KP1 · SHA256 verificado', ok: true },
        { t: 'Documentos integrados', s: '13 abr · 17:40:10', d: '7 documentos · factura, BL, CO T-MEC, packing, MSDS, NOM, decl. valor' },
        { t: 'Arribo a patio Laredo', s: '13 abr · 14:22:55', d: 'Trailer 48ft · placas TX 3J-NR1 · CTPAT verificado' },
        { t: 'Embarque cruza frontera US', s: '13 abr · 12:05:30', d: 'Puente Colombia · inspección CBP pasada' },
        { t: 'Salida Houston', s: '12 abr · 21:00:00', d: 'Bodega HTX-Westpark · seal 88412A' },
        { t: 'Packing cerrado', s: '12 abr · 14:30:11', d: '18 bultos · 12,480 kg neto · 2 tarimas euro' },
        { t: 'Factura emitida', s: '12 abr · 11:15:02', d: 'INV-HTX-88412 · USD 184,920.40 · FOB Houston' },
        { t: 'Aviso previo EVCO', s: '12 abr · 09:05:19', d: 'Solicitud de importación abierta. Folio EVCO-2024-RZ-41.' },
        { t: 'Orden de compra', s: '08 abr · 10:00:00', d: 'PO-PLSX-24-0412 · Plastimex → Houston Polymer' },
      ].map((e, i) => (
        <div key={i} style={{ position: 'relative', paddingBottom: 18 }}>
          <span style={{
            position: 'absolute', left: -23, top: 5, width: 10, height: 10, borderRadius: 999,
            background: e.live ? 'var(--cruz-green-2)' : 'var(--cruz-ink-3)',
            border: '1px solid ' + (e.live ? 'var(--cruz-green-2)' : 'var(--cruz-line-3)'),
            boxShadow: e.live ? '0 0 0 4px var(--cruz-green-glow)' : 'none',
          }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--cruz-fg-1)', fontSize: 'var(--cruz-fs-md)' }}>{e.t}</span>
            <span className="cruz-num" style={{ color: 'var(--cruz-fg-4)', fontSize: 10, letterSpacing: '0.05em' }}>{e.s}</span>
          </div>
          <div style={{ color: 'var(--cruz-fg-3)', fontSize: 'var(--cruz-fs-sm)', marginTop: 4 }}>{e.d}</div>
        </div>
      ))}
    </div>
  </div>
);

/* =========================================================================
   Design System reference screen — tokens, types, components.
   ========================================================================= */
const SystemScreen = () => {
  const Swatch = ({ name, token, value }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        height: 72, borderRadius: 'var(--cruz-r-2)', background: `var(${token})`,
        border: '1px solid var(--cruz-line-1)',
      }}/>
      <div>
        <div style={{ fontSize: 'var(--cruz-fs-sm)', color: 'var(--cruz-fg-1)' }}>{name}</div>
        <div className="cruz-meta">{token}</div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '56px 48px 120px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 56 }}>
        <div className="cruz-eyebrow" style={{ marginBottom: 12 }}>CRUZ DESIGN SYSTEM · v1.0</div>
        <h1 style={{
          fontFamily: 'var(--cruz-font-display)', fontWeight: 300,
          fontSize: 72, letterSpacing: '-0.03em', margin: 0, color: 'var(--cruz-fg-1)',
        }}>La biblioteca.</h1>
        <p style={{ maxWidth: 620, color: 'var(--cruz-fg-3)', fontSize: 'var(--cruz-fs-md)', lineHeight: 1.5, marginTop: 16 }}>
          Tokens, tipografía y componentes del portal CRUZ. Todo derivado de variables CSS en <span className="cruz-num">styles/tokens.css</span> — referenciables directo desde cualquier producto Claude Code construya sobre esta base.
        </p>
      </div>

      <section style={{ marginBottom: 64 }}>
        <div className="cruz-section-title">
          <h2>Superficies</h2>
          <span className="eyebrow">5 NIVELES + HAIRLINES</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          <Swatch name="Void" token="--cruz-ink-0"/>
          <Swatch name="Surface" token="--cruz-ink-1"/>
          <Swatch name="Raised" token="--cruz-ink-2"/>
          <Swatch name="Card" token="--cruz-ink-3"/>
          <Swatch name="Card hover" token="--cruz-ink-4"/>
        </div>
      </section>

      <section style={{ marginBottom: 64 }}>
        <div className="cruz-section-title">
          <h2>Acento</h2>
          <span className="eyebrow">EMERALD · RESERVED FOR STATE: HEALTHY, LIVE</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          <Swatch name="Green 1" token="--cruz-green-1"/>
          <Swatch name="Green 2 · PRIMARY" token="--cruz-green-2"/>
          <Swatch name="Green 3" token="--cruz-green-3"/>
          <Swatch name="Ice · secondary" token="--cruz-ice-2"/>
          <Swatch name="Amber · warn" token="--cruz-amber"/>
        </div>
      </section>

      <section style={{ marginBottom: 64 }}>
        <div className="cruz-section-title">
          <h2>Tipografía</h2>
          <span className="eyebrow">3 FAMILIAS · USO ESTRICTO</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, borderTop: '1px solid var(--cruz-line-1)', paddingTop: 32 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 32, alignItems: 'baseline' }}>
            <div>
              <div className="cruz-eyebrow">DISPLAY</div>
              <div className="cruz-meta" style={{ marginTop: 6 }}>Fraunces · 200–400</div>
              <div className="cruz-meta">Hero numbers, module titles, brand</div>
            </div>
            <div style={{ fontFamily: 'var(--cruz-font-display)', fontWeight: 300, fontSize: 88, lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--cruz-fg-1)' }}>
              La frontera, en claro.
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 32, alignItems: 'baseline' }}>
            <div>
              <div className="cruz-eyebrow">SANS</div>
              <div className="cruz-meta" style={{ marginTop: 6 }}>Inter Tight · 300–600</div>
              <div className="cruz-meta">UI, body, labels</div>
            </div>
            <div style={{ fontFamily: 'var(--cruz-font-sans)', fontSize: 24, lineHeight: 1.3, color: 'var(--cruz-fg-1)', maxWidth: 620 }}>
              Pedimento 240-2601-6002104 · Liberado vía semáforo verde. Valor en aduana USD 184,920.
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 32, alignItems: 'baseline' }}>
            <div>
              <div className="cruz-eyebrow">MONO</div>
              <div className="cruz-meta" style={{ marginTop: 6 }}>JetBrains Mono · 400–500</div>
              <div className="cruz-meta">Datos, códigos, metadatos</div>
            </div>
            <div style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 20, color: 'var(--cruz-fg-1)', letterSpacing: '0.02em' }}>
              USD/MXN · 17.2725 · PATENTE 3596 · ADUANA 240
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 64 }}>
        <div className="cruz-section-title">
          <h2>Componentes</h2>
          <span className="eyebrow">BUTTONS · BADGES · INPUTS</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="cruz-card" style={{ padding: 28 }}>
            <div className="cruz-eyebrow" style={{ marginBottom: 18 }}>BOTONES</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button className="cruz-btn cruz-btn--primary">Primary <Icon name="arrow" size={13}/></button>
              <button className="cruz-btn cruz-btn--accent">Accent</button>
              <button className="cruz-btn cruz-btn--ghost">Ghost</button>
              <button className="cruz-btn cruz-btn--ghost cruz-btn--sm">Ghost sm</button>
              <button className="cruz-btn cruz-btn--primary cruz-btn--lg">Large</button>
            </div>
          </div>
          <div className="cruz-card" style={{ padding: 28 }}>
            <div className="cruz-eyebrow" style={{ marginBottom: 18 }}>BADGES</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Badge variant="live" dot>EN VIVO</Badge>
              <Badge variant="info">INFO</Badge>
              <Badge variant="warn">REVISAR</Badge>
              <Badge variant="alert">ALERTA</Badge>
              <Badge>DEFAULT</Badge>
            </div>
          </div>
          <div className="cruz-card" style={{ padding: 28 }}>
            <div className="cruz-eyebrow" style={{ marginBottom: 18 }}>INPUT</div>
            <label className="cruz-label">CÓDIGO DE ACCESO</label>
            <input className="cruz-input" placeholder="• • • • • •"/>
          </div>
          <div className="cruz-card" style={{ padding: 28 }}>
            <div className="cruz-eyebrow" style={{ marginBottom: 18 }}>SPARKLINE</div>
            <Sparkline data={[30,45,42,60,55,70,68,82,78,90,88,100]} accent id="sys-spark"/>
          </div>
        </div>
      </section>

      <section>
        <div className="cruz-section-title">
          <h2>Principios</h2>
          <span className="eyebrow">PARA CLAUDE CODE</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            ['01', 'Los números son el producto', 'Tabular, grandes, con confianza. Serif para hero, mono para datos densos. Nunca pad con decimales innecesarios.'],
            ['02', 'Emerald tiene un solo trabajo', 'Sólo para "en vivo" y "saludable". No para hovers, no para decoración. Si algo brilla verde, significa algo.'],
            ['03', 'Superficies por capas', '5 niveles de ink. Hairlines a 6–16% alpha. Nada flota sin jerarquía.'],
            ['04', 'Movimiento ambiente', 'Pulsos, scans, sparklines que respiran. Sutil pero constante — "el sistema está vivo".'],
            ['05', 'Monospace para metadatos', 'Patentes, fracciones, IDs, fechas relativas. Cualquier cosa que sea ID va en mono.'],
            ['06', 'Tradición + precisión', 'Establecido 1941. Referenciar en footers, logins, pies. Da peso sin gritar.'],
          ].map(([n, t, d]) => (
            <div key={n} className="cruz-card" style={{ padding: 24 }}>
              <div className="cruz-num" style={{ fontFamily: 'var(--cruz-font-mono)', fontSize: 'var(--cruz-fs-tiny)', letterSpacing: '0.2em', color: 'var(--cruz-fg-5)' }}>{n}</div>
              <div style={{ fontFamily: 'var(--cruz-font-display)', fontWeight: 400, fontSize: 22, color: 'var(--cruz-fg-1)', marginTop: 12, letterSpacing: '-0.015em' }}>{t}</div>
              <div style={{ fontSize: 'var(--cruz-fs-sm)', color: 'var(--cruz-fg-3)', lineHeight: 1.5, marginTop: 10 }}>{d}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

Object.assign(window, { DetailScreen, SystemScreen });
