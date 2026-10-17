import { useEffect, useRef, useState } from 'react';

/** Clean, round tick values covering [min, max], about `count` of them. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) {
    min = min - 1;
    max = max + 1;
  }
  const rough = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/** Compact number for axes: 1,200 → 1.2K. */
export function compact(value: number): string {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}K`;
  return String(Math.round(value * 10) / 10);
}

/** The element's width, following resizes. Falls back to `fallback` where it can't be measured. */
export function useWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width;
      if (w) setWidth(Math.max(240, Math.round(w)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/**
 * Indices of about `count` evenly spaced labels, always including the first and last.
 * A week or less is labelled in full.
 */
export function labelIndices(length: number, count = 6): number[] {
  if (length <= Math.max(count, 8)) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(i * step));
}
