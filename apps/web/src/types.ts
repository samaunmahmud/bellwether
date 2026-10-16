export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type AnimalCategory = 'PET' | 'FARM';

export interface DailyRisk {
  date: string;
  level: RiskLevel;
  score: number;
  reason: string;
}

export interface RiskForecast {
  riskId: string;
  name: string;
  category: AnimalCategory;
  animals: string[];
  days: DailyRisk[];
}

export interface Forecast {
  location: { postcode: string; region: string | null };
  generatedAt: string;
  risks: RiskForecast[];
}

export interface LogEntry {
  id: string;
  date: string;
  type: string;
  note: string | null;
  nextDueDate: string | null;
}

export interface Animal {
  id: string;
  name: string;
  species: string;
  category: AnimalCategory;
  logs: LogEntry[];
}
