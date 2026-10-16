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
  postcode: string | null;
  highExposureHabitat: boolean;
  logs: LogEntry[];
}

export interface Pet extends Animal {
  forecast: Forecast | null;
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
  withdrawal: WithdrawalStatus;
  cattleType: CattleType | null;
  calvingStart: string | null;
  calvingEnd: string | null;
  movements: GroupMovement[];
}

export interface Farm extends FarmSummary {
  fields: Field[];
  groups: LivestockGroup[];
}

// --- Records (FR-6) ---

/** One correction or void (FR-6.5) */
export interface RecordRevision {
  id: string;
  action: 'EDITED' | 'VOIDED';
  at: string;
  by: string;
  reason: string;
  changes: Array<{ field: string; from: string | null; to: string | null }>;
}

/** Void status and history shared by treatments and checks (FR-6.5) */
export interface Correctable {
  voided: boolean;
  voidReason: string | null;
  history: RecordRevision[];
}

export interface TreatmentRow extends Correctable {
  id: string;
  date: string;
  productName: string;
  batchNumber: string | null;
  quantityUsed: string | null;
  animalsTreated: number;
  administeredBy: string;
  reason: string | null;
  meatWithdrawalDays: number;
  milkWithdrawalDays: number | null;
  meatWithdrawalEnds: string;
  milkWithdrawalEnds: string | null;
  group: { id: string; name: string };
}

export interface ObservationRow extends Correctable {
  id: string;
  date: string;
  type: string;
  note: string | null;
}

export interface WithdrawalStatus {
  inWithdrawal: boolean;
  meatEnds: string | null;
  milkEnds: string | null;
}

export interface GroupRecords {
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
  archivedOn: string | null;
  archiveReason: string | null;
  farm: { id: string; name: string };
  withdrawal: WithdrawalStatus;
  treatments: TreatmentRow[];
  observations: ObservationRow[];
}

// --- Briefing (FR-4, FR-5) ---

export interface BriefingItem {
  riskId: string;
  riskName: string;
  level: RiskLevel;
  daysAffected: Array<{ date: string; level: RiskLevel }>;
  reason: string;
  checks: string[];
  isNew: boolean;
}

export interface Briefing {
  date: string;
  generatedAt: string;
  isStale: boolean;
  flaggedCount: number;
  farm: { id: string; name: string };
  overdueTasks: Array<{
    id: string;
    title: string;
    dueDate: string;
    /** Null for a farm-wide task */
    group: { id: string; name: string } | null;
  }>;
  groups: Array<{
    groupId: string;
    groupName: string;
    fieldName: string | null;
    items: BriefingItem[];
  }>;
  quietGroups: Array<{ groupId: string; groupName: string }>;
}

/** FR-5.3: a task on the farm's task list */
export interface FarmTask {
  id: string;
  title: string;
  dueDate: string;
  note: string | null;
  done: boolean;
  overdue: boolean;
  repeatEveryDays: number | null;
  group: { id: string; name: string } | null;
}
