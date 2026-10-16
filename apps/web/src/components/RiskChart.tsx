import { shortDay } from '../dates';
import type { DailyRisk } from '../types';

/** Lightweight 14-day bar chart. Each bar is labelled for screen readers. */
export function RiskChart({ days, title }: { days: DailyRisk[]; title: string }) {
  return (
    <figure className="chart" aria-label={`${title}: 14-day risk chart`}>
      <ol className="chart__bars">
        {days.map((d) => (
          <li key={d.date} className="chart__col" title={`${shortDay(d.date)}: ${d.level}`}>
            <span
              className={`chart__bar chart__bar--${d.level.toLowerCase()}`}
              style={{ height: `${Math.max(d.score, 4)}%` }}
              aria-label={`${shortDay(d.date)}: ${d.level.toLowerCase()} risk`}
            />
          </li>
        ))}
      </ol>
      {days.length > 0 && (
        <figcaption className="chart__axis">
          <span>{shortDay(days[0]!.date)}</span>
          <span>{shortDay(days[days.length - 1]!.date)}</span>
        </figcaption>
      )}
    </figure>
  );
}
