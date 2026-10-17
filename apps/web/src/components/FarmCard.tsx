import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { FARM_CARD_QUERY } from '../graphql/v3';
import { ROLE_LABELS } from '../roles';
import type { FarmSummary, WeatherDay } from '../types';
import { CountUp } from './CountUp';
import { Icon } from './Icon';
import { farmPhoto, Photo } from './photos';

interface CardData {
  farm: {
    id: string;
    stats: {
      totalHead: number;
      sheep: number;
      cattle: number;
      overdueTasks: number;
      groupsInWithdrawal: number;
    };
    weather: Array<Pick<WeatherDay, 'date' | 'tempMaxC' | 'tempMinC' | 'precipitationMm'>>;
  } | null;
}

/** v3.2: one farm on My farms – its photo, a few figures and today's weather, loaded per card. */
export function FarmCard({ farm }: { farm: FarmSummary }) {
  const { data, loading } = useQuery<CardData>(FARM_CARD_QUERY, { variables: { id: farm.id } });
  const stats = data?.farm?.stats;
  const today = data?.farm?.weather[0];

  return (
    <li className="farm-tile">
      <Link to={`/farms/${farm.id}`} className="farm-tile__media">
        <Photo name={stats ? farmPhoto(stats) : 'fell'} />
        <span className="farm-tile__title">
          <strong>{farm.name}</strong>
          <span>{farm.postcode}</span>
        </span>
        {farm.myRole && farm.myRole !== 'OWNER' && (
          <span className="pill farm-tile__role">{ROLE_LABELS[farm.myRole]}</span>
        )}
        {today && (
          <span className="farm-tile__weather">
            <Icon name={today.precipitationMm >= 1 ? 'drop' : 'forecast'} size={16} />
            {Math.round(today.tempMaxC)}° / {Math.round(today.tempMinC)}°
          </span>
        )}
      </Link>
      <div className="farm-tile__body">
        {stats ? (
          <ul className="farm-tile__stats" aria-label={`${farm.name} at a glance`}>
            <li>
              <strong>
                <CountUp value={stats.totalHead} />
              </strong>
              <span>animals</span>
            </li>
            <li className={stats.overdueTasks > 0 ? 'is-alert' : ''}>
              <strong>
                <CountUp value={stats.overdueTasks} />
              </strong>
              <span>overdue tasks</span>
            </li>
            <li className={stats.groupsInWithdrawal > 0 ? 'is-alert' : ''}>
              <strong>
                <CountUp value={stats.groupsInWithdrawal} />
              </strong>
              <span>in withdrawal</span>
            </li>
          </ul>
        ) : loading ? (
          <div className="skeleton farm-tile__skeleton" aria-hidden="true" />
        ) : null}
        <div className="farm-tile__actions">
          <Link
            to={`/farms/${farm.id}`}
            className="button"
            aria-label={`Dashboard for ${farm.name}`}
          >
            Dashboard
          </Link>
          <Link
            to={`/farms/${farm.id}/briefing`}
            className="button button--secondary"
            aria-label={`Briefing for ${farm.name}`}
          >
            Briefing
          </Link>
          <Link
            to={`/farms/${farm.id}/map`}
            className="button button--secondary"
            aria-label={`Map of ${farm.name}`}
          >
            Map
          </Link>
        </div>
      </div>
    </li>
  );
}
