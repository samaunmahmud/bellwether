import type { RiskLevel } from '../types';

const LABEL: Record<RiskLevel, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

/** Colour-coded, but the text label is always shown so colour is never the only signal. */
export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={`badge badge--${level.toLowerCase()}`}>{LABEL[level]}</span>;
}
