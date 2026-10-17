import { useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';
import { FORECAST_QUERY } from '../graphql/queries';
import type { Forecast, RiskLevel } from '../types';
import { usePrefersReducedMotion } from './motion';

const LEVEL_WORD: Record<RiskLevel, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };
const CYCLE_MS = 6000;

/**
 * v3.2: today's real farm risks for one place, from the public forecast, turning over every few
 * seconds (paused on hover or focus, and when motion is reduced). Hidden if the forecast fails.
 */
export function LiveConditions({ postcode, place }: { postcode: string; place: string }) {
  const { data } = useQuery<{ forecast: Forecast }>(FORECAST_QUERY, {
    variables: { postcode, category: 'FARM' },
  });
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const risks = data?.forecast.risks.filter((r) => r.days.length > 0) ?? [];

  useEffect(() => {
    if (reduced || paused || risks.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % risks.length), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [reduced, paused, risks.length]);

  if (risks.length === 0) return null;
  const risk = risks[index % risks.length]!;
  const today = risk.days[0]!;

  return (
    <section
      className="live"
      aria-label={`Today's animal health risks near ${place}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <p className="live__head">
        <span className="live__dot" aria-hidden="true" />
        Live today near {place}
      </p>
      <div className="live__body" key={risk.riskId}>
        <p className="live__risk">
          <strong>{risk.name}</strong>
          <span className={`badge badge--${today.level.toLowerCase()}`}>
            {LEVEL_WORD[today.level]}
          </span>
        </p>
        <p className="live__reason">{today.reason}</p>
        <ol className="live__week" aria-label="Next 7 days">
          {risk.days.slice(0, 7).map((d) => (
            <li key={d.date} className={`live__day live__day--${d.level.toLowerCase()}`}>
              <span className="visually-hidden">
                {d.date}: {LEVEL_WORD[d.level]}
              </span>
              <span aria-hidden="true">{d.level[0]}</span>
            </li>
          ))}
        </ol>
      </div>
      {risks.length > 1 && (
        <div className="live__dots">
          {risks.map((r, i) => (
            <button
              key={r.riskId}
              type="button"
              className="live__pick"
              aria-label={`Show ${r.name}`}
              aria-pressed={i === index % risks.length}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
