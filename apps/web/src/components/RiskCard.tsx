import { useState } from 'react';
import { shortDay } from '../dates';
import type { RiskForecast } from '../types';
import { RiskBadge } from './RiskBadge';
import { RiskChart } from './RiskChart';

const PREVIEW_DAYS = 3;

export function RiskCard({ risk }: { risk: RiskForecast }) {
  const [expanded, setExpanded] = useState(false);
  const today = risk.days[0];
  const shown = expanded ? risk.days : risk.days.slice(0, PREVIEW_DAYS);

  return (
    <article className="card" aria-labelledby={`risk-${risk.riskId}`}>
      <header className="card__header">
        <div>
          <h3 id={`risk-${risk.riskId}`}>{risk.name}</h3>
          <p className="muted">{risk.animals.join(', ')}</p>
        </div>
        {today && <RiskBadge level={today.level} />}
      </header>

      {today && <p className="card__reason">{today.reason}</p>}

      <RiskChart days={risk.days} title={risk.name} />

      <ul className="days">
        {shown.map((d) => (
          <li key={d.date} className="days__row">
            <span className="days__date">{shortDay(d.date)}</span>
            <RiskBadge level={d.level} />
            <span className="days__reason">{d.reason}</span>
          </li>
        ))}
      </ul>

      {risk.days.length > PREVIEW_DAYS && (
        <button type="button" className="link-button" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show fewer days' : `Show all ${risk.days.length} days`}
        </button>
      )}
    </article>
  );
}
