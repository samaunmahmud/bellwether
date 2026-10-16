import type { Forecast } from '../types';
import { Disclaimer } from './Disclaimer';
import { RiskCard } from './RiskCard';

export function ForecastView({ forecast }: { forecast: Forecast }) {
  const { location } = forecast;
  return (
    <section>
      <p className="muted">
        14-day outlook for <strong>{location.postcode}</strong>
        {location.region ? ` (${location.region})` : ''}
      </p>
      <div className="grid">
        {forecast.risks.map((risk) => (
          <RiskCard key={risk.riskId} risk={risk} />
        ))}
      </div>
      <Disclaimer />
    </section>
  );
}
