import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { dayMonth } from '../dates';
import { GROUP_PERFORMANCE_QUERY } from '../graphql/v3';
import type { RegisterEvent, WeightPoint } from '../types';
import { BarChart } from './charts/BarChart';
import { LineChart } from './charts/LineChart';
import { StatTile } from './StatTile';

interface PerformanceData {
  livestockGroup: {
    id: string;
    name: string;
    weights: WeightPoint[];
    registerEvents: RegisterEvent[];
  } | null;
}

/** v3: a group's growth, worm egg counts and body condition over time. */
export function GroupPerformance({ groupId, farmId }: { groupId: string; farmId: string }) {
  const { data, loading } = useQuery<PerformanceData>(GROUP_PERFORMANCE_QUERY, {
    variables: { id: groupId },
  });
  if (loading || !data?.livestockGroup) return null;
  const { weights, registerEvents } = data.livestockGroup;
  const oldestFirst = [...registerEvents].filter((e) => !e.voided).reverse();
  const fec = oldestFirst.filter((e) => e.kind === 'FEC' && e.value !== null);
  const bcs = oldestFirst.filter((e) => e.kind === 'BODY_CONDITION' && e.value !== null);
  const latest = weights.at(-1);
  const gains = weights.filter((w) => w.dailyGainKg !== null);
  const recordLink = (kind: string) => `/farms/${farmId}/register?record=${kind}`;

  if (weights.length === 0 && fec.length === 0 && bcs.length === 0)
    return (
      <section className="panel" aria-labelledby="perf-heading">
        <h2 id="perf-heading">Performance</h2>
        <p className="empty">
          No weights, worm egg counts or condition scores yet.{' '}
          <Link to={recordLink('WEIGHING')}>Record a weighing</Link> to start a growth chart.
        </p>
      </section>
    );

  return (
    <section className="panel" aria-labelledby="perf-heading">
      <div className="panel__head">
        <h2 id="perf-heading">Performance</h2>
        <Link to={recordLink('WEIGHING')}>Record weights</Link>
      </div>
      <div className="stats">
        {latest && (
          <StatTile
            label="Latest average weight"
            value={`${latest.averageKg} kg`}
            note={dayMonth(latest.date)}
          />
        )}
        {gains.length > 0 && (
          <StatTile
            label="Daily live-weight gain"
            value={`${gains.at(-1)!.dailyGainKg} kg/day`}
            note="Since the weighing before"
          />
        )}
        {fec.length > 0 && (
          <StatTile
            label="Latest egg count"
            value={`${fec.at(-1)!.value} epg`}
            note={dayMonth(fec.at(-1)!.date)}
          />
        )}
        {bcs.length > 0 && (
          <StatTile
            label="Latest condition score"
            value={bcs.at(-1)!.value}
            note={dayMonth(bcs.at(-1)!.date)}
          />
        )}
      </div>
      <div className="dashboard__grid">
        {weights.length > 0 && (
          <div>
            <h3>Average weight</h3>
            <LineChart
              title={`Average weight of ${data.livestockGroup.name}`}
              labels={weights.map((w) => dayMonth(w.date))}
              series={[
                {
                  name: 'Average weight',
                  color: 'var(--series-1)',
                  values: weights.map((w) => w.averageKg),
                },
              ]}
              unit="kg"
              height={180}
            />
          </div>
        )}
        {fec.length > 0 && (
          <div>
            <h3>Worm egg counts</h3>
            <BarChart
              title={`Faecal egg counts for ${data.livestockGroup.name}`}
              labels={fec.map((e) => dayMonth(e.date))}
              values={fec.map((e) => e.value!)}
              unit="epg"
              color="var(--series-2)"
            />
            <p className="muted">
              Discuss egg counts with your vet or adviser before deciding whether to treat.
            </p>
          </div>
        )}
        {bcs.length > 0 && (
          <div>
            <h3>Body condition</h3>
            <LineChart
              title={`Average body condition score of ${data.livestockGroup.name}`}
              labels={bcs.map((e) => dayMonth(e.date))}
              series={[
                {
                  name: 'Condition score',
                  color: 'var(--series-3)',
                  values: bcs.map((e) => e.value),
                },
              ]}
              unit=""
              format={(v) => `score ${v}`}
              height={180}
            />
          </div>
        )}
      </div>
    </section>
  );
}
