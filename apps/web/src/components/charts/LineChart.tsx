import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { compact, labelIndices, niceTicks, useWidth } from './chartUtils';

export interface LineSeries {
  name: string;
  /** A CSS colour, normally a --series-N variable */
  color: string;
  values: Array<number | null>;
}

export interface LineChartProps {
  /** Names the chart for screen readers and heads the table */
  title: string;
  /** One label per point, shared by every series (e.g. dates) */
  labels: string[];
  series: LineSeries[];
  unit: string;
  height?: number;
  /** Text for a point in the tooltip and table; defaults to the value and unit */
  format?: (value: number) => string;
}

const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

/**
 * A small line chart: 2px lines, a crosshair and tooltip on hover or arrow keys, a legend for
 * two or more series, and a table view so nothing depends on seeing the chart.
 */
export function LineChart({ title, labels, series, unit, height = 220, format }: LineChartProps) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const show = format ?? ((v: number) => `${Math.round(v * 10) / 10} ${unit}`);

  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (labels.length === 0 || all.length === 0)
    return <p className="muted">No data to chart yet.</p>;

  const ticks = niceTicks(Math.min(...all), Math.max(...all));
  const lo = ticks[0]!;
  const hi = ticks.at(-1)!;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (labels.length === 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;

  const path = (values: Array<number | null>) =>
    values
      .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
      .reduce<string>((d, point, i) => {
        if (!point) return d;
        const prevMissing = i === 0 || values[i - 1] === null;
        return `${d}${prevMissing ? 'M' : 'L'}${point} `;
      }, '');

  function pick(e: MouseEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - box.left) / box.width) * plotW;
    const i = Math.round((rel / plotW) * (labels.length - 1));
    setActive(Math.max(0, Math.min(labels.length - 1, i)));
  }

  function keys(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const step = e.key === 'ArrowRight' ? 1 : -1;
      setActive((a) => Math.max(0, Math.min(labels.length - 1, (a ?? -step) + step)));
    } else if (e.key === 'Escape') setActive(null);
  }

  return (
    <figure className="viz" ref={ref}>
      {series.length > 1 && (
        <ul className="viz__legend" aria-label="Legend">
          {series.map((s) => (
            <li key={s.name}>
              <span className="viz__key viz__key--line" style={{ background: s.color }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div className="viz__plot">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${title}. Use the left and right arrow keys to read values.`}
          tabIndex={0}
          onKeyDown={keys}
          onBlur={() => setActive(null)}
        >
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
            <text key={i} className="viz__tick" x={x(i)} y={height - 8} textAnchor="middle">
              {labels[i]}
            </text>
          ))}
          {series.map((s) => (
            <path key={s.name} className="viz__line" d={path(s.values)} stroke={s.color} />
          ))}
          {series.map((s) => {
            const lastIndex = s.values.reduce<number>((last, v, i) => (v === null ? last : i), -1);
            const last = s.values[lastIndex];
            return last == null ? null : (
              <circle
                key={s.name}
                className="viz__dot"
                cx={x(lastIndex)}
                cy={y(last)}
                r={4}
                fill={s.color}
              />
            );
          })}
          {active !== null && (
            <g>
              <line
                className="viz__crosshair"
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={PAD.top + plotH}
              />
              {series.map((s) => {
                const v = s.values[active];
                return v == null ? null : (
                  <circle
                    key={s.name}
                    className="viz__dot"
                    cx={x(active)}
                    cy={y(v)}
                    r={5}
                    fill={s.color}
                  />
                );
              })}
            </g>
          )}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onMouseMove={pick}
            onMouseLeave={() => setActive(null)}
          />
        </svg>
        {active !== null && (
          <div
            className="viz__tooltip"
            role="status"
            style={{ left: Math.min(x(active) + 12, width - 170) }}
          >
            <strong>{labels[active]}</strong>
            {series.map((s) => {
              const v = s.values[active];
              return (
                <span key={s.name}>
                  <span className="viz__key viz__key--line" style={{ background: s.color }} />
                  {series.length > 1 && `${s.name}: `}
                  {v == null ? '–' : show(v)}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <details className="viz__table">
        <summary>Show as a table</summary>
        <table>
          <caption className="visually-hidden">{title}</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              {series.map((s) => (
                <th key={s.name} scope="col">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, i) => (
              <tr key={`${label}-${i}`}>
                <th scope="row">{label}</th>
                {series.map((s) => (
                  <td key={s.name}>{s.values[i] == null ? '–' : show(s.values[i]!)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
