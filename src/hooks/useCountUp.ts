'use client';
import { useEffect, useState } from 'react';

/**
 * useCountUp — animated count-up hook for hero KPI numbers.
 *
 * Plain camelCase counterpart to ./use-count-up.ts. Plain hook that returns
 * a smoothed value rising to `target` over `ms` milliseconds. Respects
 * prefers-reduced-motion and SSR (snaps to target server-side).
 */
export function useCountUp(target: number, ms = 600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') {
      setValue(target);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}
