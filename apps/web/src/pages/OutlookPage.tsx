import { useQuery } from '@apollo/client';
import { DayStrip } from '../components/DayStrip';
import { Link, useParams } from 'react-router-dom';
import { BarChart } from '../components/charts/BarChart';
import { LineChart } from '../components/charts/LineChart';
import { Disclaimer } from '../components/Disclaimer';
import { RiskHeatmap } from '../components/RiskHeatmap';
import { shortDay } from '../dates';
import { OUTLOOK_QUERY } from '../graphql/v3';
import type { HeatmapGroup, WeatherDay } from '../types';

interface OutlookFarm {
  id: string;
  name: string;
  weather: Array<Required<WeatherDay>>;
  groups: HeatmapGroup[];
}

const dayLabel = (iso: string) => {
  const [weekday, day] = shortDay(iso).split(' ');
  return `${weekday} ${day}`;
};

/** v3: 14 days of weather and every group's risks, side by side. */
export function OutlookPage() {
  const { id = '' } = useParams();
  const { data, loading, error } = useQuery<{ farm: OutlookFarm | null }>(OUTLOOK_QUERY, {
    variables: { id },
  });
  if (loading) return <p aria-live="polite">Loading the outlook…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  const farm = data?.farm;
  if (!farm) return <h1>Farm not found</h1>;
  const labels = farm.weather.map((d) => dayLabel(d.date));
  const totalRain = farm.weather.reduce((t, d) => t + d.precipitationMm, 0);
  const wettest = [...farm.weather].sort((a, b) => b.precipitationMm - a.precipitationMm)[0];
  const hottest = [...farm.weather].sort((a, b) => b.tempMaxC - a.tempMaxC)[0];

  return (
    <section>
      <p className="muted">
        <Link to={`/farms/${farm.id}`}>{farm.name}</Link>
      </p>
      <h1>Weather and risk</h1>
      <p className="lead">The next 14 days at the farm, and what they mean for each group.</p>

      {farm.weather.length > 0 && (
        <div className="stats">
          <div className="stat">
            <span className="stat__label">Rain over 14 days</span>
            <span className="stat__value">{Math.round(totalRain)} mm</span>
            {wettest && (
              <span className="stat__note">
                Wettest {shortDay(wettest.date)}: {Math.round(wettest.precipitationMm)} mm
              </span>
            )}
          </div>
          {hottest && (
            <div className="stat">
              <span className="stat__label">Warmest day</span>
              <span className="stat__value">{Math.round(hottest.tempMaxC)}°C</span>
              <span className="stat__note">{shortDay(hottest.date)}</span>
            </div>
          )}
        </div>
      )}

      {farm.weather.length > 0 && <DayStrip days={farm.weather} />}

      <div className="dashboard__grid">
        <section className="panel" aria-labelledby="temp-heading">
          <h2 id="temp-heading">Temperature</h2>
          <LineChart
            title="Daily high, average and low temperature, next 14 days"
            labels={labels}
            series={[
              {
                name: 'High',
                color: 'var(--series-2)',
                values: farm.weather.map((d) => d.tempMaxC),
              },
              {
                name: 'Average',
                color: 'var(--series-3)',
                values: farm.weather.map((d) => d.tempMeanC),
              },
              {
                name: 'Low',
                color: 'var(--series-1)',
                values: farm.weather.map((d) => d.tempMinC),
              },
            ]}
            unit="°C"
          />
        </section>
        <section className="panel" aria-labelledby="rain-heading">
          <h2 id="rain-heading">Rain</h2>
          <BarChart
            title="Daily rain, next 14 days"
            labels={labels}
            values={farm.weather.map((d) => d.precipitationMm)}
            unit="mm"
          />
          <h2 id="humidity-heading">Humidity</h2>
          <LineChart
            title="Daily average humidity, next 14 days"
            labels={labels}
            series={[
              {
                name: 'Humidity',
                color: 'var(--series-1)',
                values: farm.weather.map((d) => d.humidityMeanPct),
              },
            ]}
            unit="%"
            height={160}
          />
        </section>
      </div>

      <section className="panel" aria-labelledby="heatmap-heading">
        <h2 id="heatmap-heading">Risk for each group, 14 days</h2>
        <RiskHeatmap groups={farm.groups} />
      </section>
      <Disclaimer />
    </section>
  );
}
