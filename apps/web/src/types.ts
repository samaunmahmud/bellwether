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

// --- Farms (FR-2) ---

export type Species = 'SHEEP' | 'CATTLE';
export type LivestockClass = 'EWES' | 'LAMBS' | 'RAMS' | 'DAIRY_COWS' | 'BEEF_CATTLE' | 'CALVES';
export type CattleType = 'DAIRY' | 'BEEF';

export interface FarmSummary {
  id: string;
  name: string;
  postcode: string;
}

export interface FieldOption {
  id: string;
  name: string;
}

export interface Field extends FieldOption {
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface GroupMovement {
  id: string;
  movedOn: string;
  fromField: FieldOption | null;
  toField: FieldOption;
}

export interface LivestockGroup {
  id: string;
  name: string;
  species: Species;
  livestockClass: LivestockClass;
  headCount: number;
  housed: boolean;
  currentField: FieldOption | null;
  lastShearingDate: string | null;
  lambingStart: string | null;
  lambingEnd: string | null;
  lambsAtGrassThisSpring: boolean;
  cattleType: CattleType | null;
  calvingStart: string | null;
  calvingEnd: string | null;
  movements: GroupMovement[];
}

export interface Farm extends FarmSummary {
  fields: Field[];
  groups: LivestockGroup[];
}
