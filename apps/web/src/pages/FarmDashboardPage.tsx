import { useQuery } from '@apollo/client';
import { Link, useParams } from 'react-router-dom';
import { LineChart } from '../components/charts/LineChart';
import { Disclaimer } from '../components/Disclaimer';
import { Icon } from '../components/Icon';
import { RiskHeatmap } from '../components/RiskHeatmap';
import { StatTile } from '../components/StatTile';
import { dayMonth, shortDay } from '../dates';
import { DASHBOARD_QUERY } from '../graphql/v3';
import { canWork, ROLE_LABELS } from '../roles';
import type {
  ActivityItem,
  FarmAlert,
  FarmRole,
  FarmStats,
  HeatmapGroup,
  WeatherDay,
} from '../types';

interface DashboardFarm {
  id: string;
  name: string;
  postcode: string;
  cphNumber: string | null;
  flockMark: string | null;
  myRole: FarmRole;
  stats: FarmStats;
  alerts: FarmAlert[];
  activity: ActivityItem[];
  weather: WeatherDay[];
  groups: Array<HeatmapGroup & { species: string; headCount: number }>;
}

const ALERT_WORD = { URGENT: 'Urgent', WARNING: 'Soon', INFO: 'Note' } as const;

const percent = (value: number | null) => (value === null ? '–' : `${value}%`);

/** v3: the farm at a glance – figures, what needs doing, this week's risk, weather and activity. */
export function FarmDashboardPage() {
  const { id = '' } = useParams();
  const { data, loading, error } = useQuery<{ farm: DashboardFarm | null }>(DASHBOARD_QUERY, {
    variables: { id },
  });

  if (loading) return <DashboardSkeleton />;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  const farm = data?.farm;
  if (!farm) return <h1>Farm not found</h1>;
  const { stats } = farm;
  const worker = canWork(farm.myRole);
  const highThisWeek = farm.groups
    .flatMap((g) => g.forecast.risks.map((r) => ({ group: g, risk: r })))
    .filter(({ risk }) => risk.days.slice(0, 7).some((d) => d.level === 'HIGH'));
  const weekWeather = farm.weather.slice(0, 7);

  return (
    <section className="dashboard">
      <header className="page-title">
        <div>
          <p className="eyebrow">
            {farm.postcode}
            {farm.cphNumber && ` · CPH ${farm.cphNumber}`}
            {farm.flockMark && ` · ${farm.flockMark}`}
            {farm.myRole !== 'OWNER' && ` · ${ROLE_LABELS[farm.myRole]}`}
          </p>
          <h1>{farm.name}</h1>
        </div>
        {worker && (
          <div className="quick-actions" aria-label="Quick actions">
            <Link
              to={`/farms/${farm.id}/register?record=DEATH`}
              className="button button--secondary"
            >
              <Icon name="plus" size={18} /> Record a loss
            </Link>
            <Link
              to={`/farms/${farm.id}/register?record=WEIGHING`}
              className="button button--secondary"
            >
              <Icon name="scale" size={18} /> Record weights
            </Link>
            <Link to={`/farms/${farm.id}/tasks`} className="button button--secondary">
              <Icon name="tasks" size={18} /> Add a task
            </Link>
            <Link to={`/farms/${farm.id}/briefing`} className="button">
              <Icon name="briefing" size={18} /> Morning briefing
            </Link>
          </div>
        )}
      </header>

      <div className="stats" aria-label="Farm figures">
        <StatTile
          label="Animals on the holding"
          value={stats.totalHead.toLocaleString('en-GB')}
          note={`${stats.sheep.toLocaleString('en-GB')} sheep · ${stats.cattle.toLocaleString('en-GB')} cattle`}
          to={`/farms/${farm.id}/livestock`}
        />
        <StatTile
          label="Tasks overdue"
          value={stats.overdueTasks}
          note={`${stats.openTasks} still to do`}
          tone={stats.overdueTasks > 0 ? 'alert' : undefined}
          to={`/farms/${farm.id}/tasks`}
        />
        <StatTile
          label="Groups in withdrawal"
          value={stats.groupsInWithdrawal}
          note={stats.groupsInWithdrawal ? 'Check before selling' : 'All groups clear'}
          tone={stats.groupsInWithdrawal > 0 ? 'alert' : 'good'}
          to={`/farms/${farm.id}/records`}
        />
        <StatTile
          label="Losses, last 12 months"
          value={percent(stats.mortalityPct)}
          note={`${stats.deaths} died · ${stats.movedOff} sold or moved off`}
          to={`/farms/${farm.id}/register`}
        />
        <StatTile
          label="Born alive, last 12 months"
          value={percent(stats.birthSurvivalPct)}
          note={`${stats.bornAlive} alive · ${stats.bornDead} dead`}
          to={`/farms/${farm.id}/register`}
        />
      </div>

      <div className="dashboard__grid">
        <section className="panel" aria-labelledby="alerts-heading">
          <h2 id="alerts-heading">Needs attention</h2>
          {farm.alerts.length === 0 ? (
            <p className="empty">Nothing needs attention. Good work.</p>
          ) : (
            <ul className="alerts">
              {farm.alerts.map((a, i) => (
                <li key={i} className={`alert alert--${a.level.toLowerCase()}`}>
                  <span className="alert__level">{ALERT_WORD[a.level]}</span>
                  <Link to={a.link} className="alert__body">
                    <strong>{a.title}</strong>
                    <span className="muted">{a.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="week-heading">
          <div className="panel__head">
            <h2 id="week-heading">This week’s weather</h2>
            <Link to={`/farms/${farm.id}/outlook`}>14-day outlook</Link>
          </div>
          {weekWeather.length > 0 ? (
            <>
              <LineChart
                title={`Daily high and low temperature at ${farm.postcode}, next 7 days`}
                labels={weekWeather.map((d) => shortDay(d.date).split(' ')[0]!)}
                series={[
                  {
                    name: 'High',
                    color: 'var(--series-2)',
                    values: weekWeather.map((d) => d.tempMaxC),
                  },
                  {
                    name: 'Low',
                    color: 'var(--series-1)',
                    values: weekWeather.map((d) => d.tempMinC),
                  },
                ]}
                unit="°C"
                height={170}
              />
              <ul className="rain-strip" aria-label="Rain each day">
                {weekWeather.map((d) => (
                  <li key={d.date}>
                    <span className="muted">{shortDay(d.date).split(' ')[0]}</span>
                    <Icon name="drop" size={14} />
                    <span>{Math.round(d.precipitationMm * 10) / 10} mm</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">Weather is unavailable right now.</p>
          )}
        </section>
      </div>

      <section className="panel" aria-labelledby="risk-heading">
        <div className="panel__head">
          <h2 id="risk-heading">Risk this week</h2>
          <span className="muted">
            {highThisWeek.length === 0
              ? 'No high risks in the next 7 days'
              : `${highThisWeek.length} high ${highThisWeek.length === 1 ? 'risk' : 'risks'} in the next 7 days`}
          </span>
        </div>
        <RiskHeatmap groups={farm.groups} days={7} />
      </section>

      <section className="panel" aria-labelledby="activity-heading">
        <div className="panel__head">
          <h2 id="activity-heading">Recent activity</h2>
          <Link to={`/farms/${farm.id}/calendar`}>Calendar</Link>
        </div>
        {farm.activity.length === 0 ? (
          <p className="empty">
            Nothing recorded yet. Record treatments, checks, births and losses and they’ll appear
            here.
          </p>
        ) : (
          <ol className="timeline">
            {farm.activity.map((a, i) => (
              <li key={i} className={`timeline__item timeline__item--${a.kind.toLowerCase()}`}>
                <time dateTime={a.date}>{dayMonth(a.date)}</time>
                <div>
                  <strong>{a.title}</strong>
                  {a.groupName && a.groupId && (
                    <>
                      {' · '}
                      <Link to={`/groups/${a.groupId}`}>{a.groupName}</Link>
                    </>
                  )}
                  {a.detail && <p className="muted">{a.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      <Disclaimer />
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="visually-hidden">Loading the farm dashboard…</p>
      <div className="skeleton skeleton--title" />
      <div className="stats">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton skeleton--tile" />
        ))}
      </div>
      <div className="skeleton skeleton--panel" />
    </div>
  );
}
