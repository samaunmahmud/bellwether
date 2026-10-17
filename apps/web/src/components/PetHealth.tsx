import { useQuery } from '@apollo/client';
import { dayMonth, shortDay, todayIso } from '../dates';
import { PET_HEALTH_QUERY } from '../graphql/v3';
import { LineChart } from './charts/LineChart';

interface HealthData {
  animal: {
    id: string;
    name: string;
    species: string;
    logs: Array<{
      id: string;
      date: string;
      type: string;
      nextDueDate: string | null;
      weightKg: number | null;
    }>;
    walkPlanner: {
      date: string;
      bestTimes: string[];
      hours: Array<{ time: string; tempC: number; level: 'GOOD' | 'WARM' | 'HOT' }>;
    } | null;
  } | null;
}

const LEVEL_WORD = { GOOD: 'Good', WARM: 'Warm', HOT: 'Hot' } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Days from today to `iso` (negative when it has passed). */
export function daysUntil(iso: string, today = todayIso()) {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

export function dueText(days: number) {
  if (days === 0) return 'Due today';
  if (days > 0) return `Due in ${days} ${days === 1 ? 'day' : 'days'}`;
  return `Overdue by ${-days} ${days === -1 ? 'day' : 'days'}`;
}

/**
 * v3: what's due next for this pet (the latest "next due" of each kind of entry), its weight over
 * time, and, for dogs, the coolest hours for a walk today.
 */
export function PetHealth({ petId }: { petId: string }) {
  const { data } = useQuery<HealthData>(PET_HEALTH_QUERY, {
    variables: { id: petId },
    fetchPolicy: 'cache-and-network',
  });
  const pet = data?.animal;
  if (!pet) return null;

  // Logs are newest first: the first of each type is the latest.
  const latestByType = new Map<string, (typeof pet.logs)[number]>();
  for (const log of pet.logs) if (!latestByType.has(log.type)) latestByType.set(log.type, log);
  const plan = [...latestByType.values()]
    .filter((l): l is typeof l & { nextDueDate: string } => l.nextDueDate !== null)
    .map((l) => ({ ...l, days: daysUntil(l.nextDueDate) }))
    .sort((a, b) => a.days - b.days);
  const weights = pet.logs.filter((l) => l.weightKg !== null).reverse();
  const walk = pet.walkPlanner;

  return (
    <div className="pet-health">
      <section className="panel" aria-labelledby="plan-heading">
        <h2 id="plan-heading">Health plan</h2>
        {plan.length === 0 ? (
          <p className="empty">
            Add a “next due” date to an entry (vaccination, worming, flea treatment) to see it here.
          </p>
        ) : (
          <ul className="plan">
            {plan.map((p) => (
              <li
                key={p.id}
                className={p.days < 0 ? 'plan__item plan__item--overdue' : 'plan__item'}
              >
                <span className="plan__days" aria-hidden="true">
                  {Math.abs(p.days)}
                  <small>{p.days < 0 ? 'days late' : p.days === 1 ? 'day' : 'days'}</small>
                </span>
                <span>
                  <strong>{p.type}</strong>
                  <span className="muted">
                    {dueText(p.days)} · {shortDay(p.nextDueDate)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {weights.length > 0 && (
        <section className="panel" aria-labelledby="weight-heading">
          <h2 id="weight-heading">Weight</h2>
          <LineChart
            title={`${pet.name}'s weight`}
            labels={weights.map((w) => dayMonth(w.date))}
            series={[
              { name: 'Weight', color: 'var(--series-1)', values: weights.map((w) => w.weightKg) },
            ]}
            unit="kg"
            height={180}
          />
        </section>
      )}

      {walk && (
        <section className="panel" aria-labelledby="walk-heading">
          <h2 id="walk-heading">Walk planner, {shortDay(walk.date)}</h2>
          <p>
            {walk.bestTimes.length > 0 ? (
              <>
                Best times for a walk: <strong>{walk.bestTimes.join(' and ')}</strong>
              </>
            ) : (
              'No cool hours today. Keep walks short and in the shade.'
            )}
          </p>
          <ol className="walk-hours" aria-label="Each hour">
            {walk.hours.map((h) => (
              <li key={h.time} className={`walk-hour walk-hour--${h.level.toLowerCase()}`}>
                <span className="walk-hour__time">{h.time.slice(11, 13)}</span>
                <span className="walk-hour__temp">{Math.round(h.tempC)}°</span>
                <span className="walk-hour__level">{LEVEL_WORD[h.level]}</span>
              </li>
            ))}
          </ol>
          <p className="muted">
            Based on temperature only. Watch your dog for signs of overheating and ask your vet if
            you’re worried.
          </p>
        </section>
      )}
    </div>
  );
}
