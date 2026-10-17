import { useState } from 'react';
import { Link } from 'react-router-dom';
import { shortDay } from '../dates';
import type { HeatmapGroup, RiskLevel } from '../types';

const LETTER: Record<RiskLevel, string> = { LOW: 'L', MEDIUM: 'M', HIGH: 'H' };
const WORD: Record<RiskLevel, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

interface Selected {
  group: string;
  risk: string;
  date: string;
  level: RiskLevel;
  reason: string;
}

/**
 * Every group × risk × day as a grid. Each cell shows its level as a letter as well as a colour,
 * and hovering, focusing or tapping it shows the day's reason underneath.
 */
export function RiskHeatmap({ groups, days = 14 }: { groups: HeatmapGroup[]; days?: number }) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const rows = groups.flatMap((g) =>
    g.forecast.risks.map((r) => ({ group: g, risk: r, days: r.days.slice(0, days) })),
  );
  if (rows.length === 0)
    return <p className="muted">No risks to show. Add a livestock group to see its forecast.</p>;
  const dates = rows[0]!.days.map((d) => d.date);

  return (
    <div className="heatmap">
      <div className="table-scroll">
        <table className="heatmap__table">
          <caption className="visually-hidden">
            Risk level for each group and risk, by day. L is low, M medium, H high.
          </caption>
          <thead>
            <tr>
              <th scope="col">Group and risk</th>
              {dates.map((d) => (
                <th key={d} scope="col" className="heatmap__date">
                  <span>{shortDay(d).split(' ')[0]}</span>
                  <span>{d.slice(8)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ group, risk, days: cells }, rowIndex) => (
              <tr key={`${group.id}-${risk.riskId}`}>
                <th scope="row" className="heatmap__label">
                  {(rowIndex === 0 || rows[rowIndex - 1]!.group.id !== group.id) && (
                    <Link to={`/groups/${group.id}`} className="heatmap__group">
                      {group.name}
                    </Link>
                  )}
                  <span>{risk.name}</span>
                </th>
                {cells.map((day) => {
                  const label = `${group.name}, ${risk.name}, ${shortDay(day.date)}: ${WORD[day.level]}. ${day.reason}`;
                  const isSelected =
                    selected?.date === day.date &&
                    selected.group === group.name &&
                    selected.risk === risk.name;
                  const choose = () =>
                    setSelected({
                      group: group.name,
                      risk: risk.name,
                      date: day.date,
                      level: day.level,
                      reason: day.reason,
                    });
                  return (
                    <td key={day.date} className="heatmap__cell-wrap">
                      <button
                        type="button"
                        className={`heatmap__cell heatmap__cell--${day.level.toLowerCase()}${isSelected ? ' is-selected' : ''}`}
                        aria-label={label}
                        aria-pressed={isSelected}
                        onMouseEnter={choose}
                        onFocus={choose}
                        onClick={choose}
                      >
                        {LETTER[day.level]}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="heatmap__detail" aria-live="polite">
        {selected ? (
          <>
            <strong>
              {selected.group} · {selected.risk} · {shortDay(selected.date)}: {WORD[selected.level]}
            </strong>{' '}
            {selected.reason}
          </>
        ) : (
          <span className="muted">Hover over or tap a day to see why.</span>
        )}
      </p>
      <ul className="heatmap__legend" aria-label="Key">
        {(['LOW', 'MEDIUM', 'HIGH'] as const).map((level) => (
          <li key={level}>
            <span className={`heatmap__swatch heatmap__cell--${level.toLowerCase()}`}>
              {LETTER[level]}
            </span>
            {WORD[level]}
          </li>
        ))}
      </ul>
    </div>
  );
}
