export type AnimalCategory = 'pet' | 'farm';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DailyWeather {
  /** ISO date, e.g. "2026-10-15" */
  date: string;
  tempMeanC: number;
  tempMaxC: number;
  tempMinC: number;
  humidityMeanPct: number;
  precipitationMm: number;
}

export interface RiskContext {
  /** Pet regularly walks in long grass or woodland */
  highExposureHabitat?: boolean;
}

export interface DailyRisk {
  date: string;
  level: RiskLevel;
  /** 0–100, used for charts */
  score: number;
  /** Plain-English explanation of why this level was given */
  reason: string;
}

export interface RiskModule {
  id: string;
  name: string;
  category: AnimalCategory;
  animals: string[];
  assess(days: DailyWeather[], ctx?: RiskContext): DailyRisk[];
}
