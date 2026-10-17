import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** True when the person has asked for less motion, or the browser can't say (tests, old browsers). */
export function prefersReducedMotion() {
  return typeof window.matchMedia !== 'function' || window.matchMedia(QUERY).matches;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(QUERY);
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Counts up from 0 to `target` over `ms` when it first appears. Shows the final value straight
 * away when motion is reduced, so the number is never wrong for long.
 */
export function useCountUp(target: number, ms = 900) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - t) ** 3;
      setValue(target * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}
