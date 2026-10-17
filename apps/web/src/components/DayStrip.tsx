import { shortDay } from '../dates';
import type { WeatherDay } from '../types';
import { Icon } from './Icon';

type Day = Pick<WeatherDay, 'date' | 'tempMaxC' | 'tempMinC' | 'precipitationMm'>;

/** Icon for a day: rain if it's wet, sun if it's warm and dry, cloud otherwise. */
export function dayIcon(day: Day) {
  if (day.precipitationMm >= 1) return 'drop' as const;
  if (day.tempMaxC >= 15) return 'sun' as const;
  return 'forecast' as const;
}

/**
 * v3.2: the fortnight as a row of day cards that scrolls sideways, with a bar showing each day's
 * rain against the wettest day.
 */
export function DayStrip({ days }: { days: Day[] }) {
  const wettest = Math.max(1, ...days.map((d) => d.precipitationMm));
  return (
    <ol className="day-strip" aria-label="Each day">
      {days.map((d, i) => {
        const [weekday, ...date] = shortDay(d.date).split(' ');
        const rain = Math.round(d.precipitationMm * 10) / 10;
        return (
          <li key={d.date} className={i === 0 ? 'day-card is-today' : 'day-card'}>
            <span className="day-card__day">{i === 0 ? 'Today' : weekday}</span>
            <span className="day-card__date muted">{date.join(' ')}</span>
            <span className="day-card__icon">
              <Icon name={dayIcon(d)} size={26} />
            </span>
            <span className="day-card__temps">
              <strong>{Math.round(d.tempMaxC)}°</strong>{' '}
              <span className="muted">{Math.round(d.tempMinC)}°</span>
            </span>
            <span className="day-card__rain">
              <span
                className="day-card__rain-bar"
                style={{ width: `${(d.precipitationMm / wettest) * 100}%` }}
                aria-hidden="true"
              />
              {rain} mm
            </span>
          </li>
        );
      })}
    </ol>
  );
}
