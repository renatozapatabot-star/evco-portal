/**
 * CRUZ · Cockpit decorative backdrop.
 *
 * Absolute-positioned, pointer-events:none, low opacity. Layers a simplified
 * US–MX corridor illustration over the cockpit canvas so the dashboard feels
 * like a control-tower view. Parent must have `position: relative`.
 */
export function CockpitBackdrop() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          width: 1600,
          height: 900,
          transform: 'translateX(-50%)',
          backgroundImage: 'url(/brand/corridor-backdrop.svg)',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'contain',
          backgroundPosition: 'center top',
          opacity: 0.55,
          mixBlendMode: 'screen',
          maskImage: 'radial-gradient(ellipse at 50% 35%, black 0%, black 55%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 35%, black 0%, black 55%, transparent 85%)',
        }}
      />
    </div>
  )
}
