/* CRUZ — Tweaks panel */

const TweaksPanel = ({ state, setState, onClose }) => {
  const upd = (k, v) => {
    const next = { ...state, [k]: v };
    setState(next);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
  };

  const Row = ({ label, children }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 0', borderBottom: '1px solid var(--cruz-line-1)' }}>
      <div className="cruz-eyebrow">{label}</div>
      {children}
    </div>
  );
  const Seg = ({ value, options, onChange }) => (
    <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--cruz-ink-3)', borderRadius: 'var(--cruz-r-2)', border: '1px solid var(--cruz-line-1)' }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          flex: 1, padding: '6px 10px', borderRadius: 6, fontSize: 'var(--cruz-fs-xs)',
          background: value === o.v ? 'var(--cruz-ink-1)' : 'transparent',
          color: value === o.v ? 'var(--cruz-fg-1)' : 'var(--cruz-fg-4)',
          border: value === o.v ? '1px solid var(--cruz-line-2)' : '1px solid transparent',
          transition: 'all 160ms',
        }}>{o.l}</button>
      ))}
    </div>
  );

  return (
    <div style={{
      position: 'fixed', right: 20, top: 80, width: 320, zIndex: 200,
      background: 'var(--cruz-ink-2)', border: '1px solid var(--cruz-line-3)',
      borderRadius: 'var(--cruz-r-4)', boxShadow: 'var(--cruz-shadow-3)',
      padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontFamily: 'var(--cruz-font-display)', fontSize: 20, fontWeight: 400, color: 'var(--cruz-fg-1)' }}>Tweaks</div>
        <button onClick={onClose} className="cruz-btn cruz-btn--ghost cruz-btn--sm cruz-btn--icon"><Icon name="plus" size={12} style={{ transform: 'rotate(45deg)' }}/></button>
      </div>
      <div className="cruz-meta" style={{ marginBottom: 8 }}>Ajusta el tema en vivo. Se persiste.</div>

      <Row label="SCREEN">
        <Seg value={state.screen} onChange={v => upd('screen', v)} options={[
          { v: 'login', l: 'Login' }, { v: 'dashboard', l: 'Dash' }, { v: 'detail', l: 'Detail' }, { v: 'system', l: 'System' },
        ]}/>
      </Row>

      <Row label="ACENTO">
        <Seg value={state.accent} onChange={v => upd('accent', v)} options={[
          { v: 'emerald', l: 'Emerald' }, { v: 'teal', l: 'Teal' }, { v: 'lime', l: 'Lime' },
        ]}/>
      </Row>

      <Row label="FONDO">
        <Seg value={state.bg} onChange={v => upd('bg', v)} options={[
          { v: 'void', l: 'Void' }, { v: 'near', l: 'Near' }, { v: 'blueprint', l: 'Blueprint' },
        ]}/>
      </Row>

      <Row label="DENSIDAD">
        <Seg value={state.density} onChange={v => upd('density', v)} options={[
          { v: 'compact', l: 'Compact' }, { v: 'comfortable', l: 'Comfortable' }, { v: 'spacious', l: 'Spacious' },
        ]}/>
      </Row>

      <Row label="TIPOGRAFÍA">
        <Seg value={state.typePair} onChange={v => upd('typePair', v)} options={[
          { v: 'editorial', l: 'Editorial' }, { v: 'grotesque', l: 'Grotesque' }, { v: 'mono-all', l: 'Mono' },
        ]}/>
      </Row>

      <Row label="MOVIMIENTO">
        <Seg value={state.motion} onChange={v => upd('motion', v)} options={[
          { v: 'on', l: 'On' }, { v: 'off', l: 'Off' },
        ]}/>
      </Row>
    </div>
  );
};

Object.assign(window, { TweaksPanel });
