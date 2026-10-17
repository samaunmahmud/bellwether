import { useState } from 'react';
import { compact, labelIndices, niceTicks, useWidth } from './chartUtils';

export interface BarChartProps {
  title: string;
  labels: string[];
  values: number[];
  unit: string;
  color?: string;
  height?: number;
  format?: (value: number) => string;
}

const PAD = { top: 16, right: 12, bottom: 28, left: 44 };
const MAX_BAR = 24;
const RADIUS = 4;

/** Path for a column with a 4px rounded top and a square base. */
function column(x: number, y: number, w: number, h: number) {
  const r = Math.min(RADIUS, h, w / 2);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/** One series of columns from a zero baseline, with a per-column tooltip and a table view. */
export function BarChart({
  title,
  labels,
  values,
  unit,
  color = 'var(--series-1)',
  height = 180,
  format,
}: BarChartProps) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const show = format ?? ((v: number) => `${Math.round(v * 10) / 10} ${unit}`);
  if (values.length === 0) return <p className="muted">No data to chart yet.</p>;

  const ticks = niceTicks(0, Math.max(...values, 1));
  const hi = ticks.at(-1)!;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const band = plotW / values.length;
  const barW = Math.max(2, Math.min(MAX_BAR, band * 0.6));
  const cx = (i: number) => PAD.left + band * i + band / 2;
  const y = (v: number) => PAD.top + plotH - (v / hi) * plotH;

  return (
    <figure className="viz" ref={ref}>
      <div className="viz__plot">
        <svg width={width} height={height} role="img" aria-label={title}>
          {ticks.map((t) => (
            <g key={t}>
              <line
                className="viz__grid"
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
              />
              <text className="viz__tick" x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {compact(t)}
              </text>
            </g>
          ))}
          {labelIndices(labels.length).map((i) => (
            <text key={i} className="viz__tick" x={cx(i)} y={height - 8} textAnchor="middle">
              {labels[i]}
            </text>
          ))}
          {values.map((v, i) => (
            <g key={i}>
              {v > 0 && (
                <path
                  d={column(cx(i) - barW / 2, y(v), barW, PAD.top + plotH - y(v))}
                  fill={color}
                  opacity={active === null || active === i ? 1 : 0.55}
                />
              )}
              {/* A hit target as wide as the band, bigger than the bar */}
              <rect
                x={cx(i) - band / 2}
                y={PAD.top}
                width={band}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${labels[i]}: ${show(v)}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            </g>
          ))}
        </svg>
        {active !== null && (
          <div
            className="viz__tooltip"
            role="status"
            style={{ left: Math.min(cx(active) + 12, width - 150) }}
          >
            <strong>{labels[active]}</strong>
            <span>{show(values[active]!)}</span>
          </div>
        )}
      </div>
      <details className="viz__table">
        <summary>Show as a table</summary>
        <table>
          <caption className="visually-hidden">{title}</caption>
          <tbody>
            {labels.map((label, i) => (
              <tr key={`${label}-${i}`}>
                <th scope="row">{label}</th>
                <td>{show(values[i]!)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
