export const typeDefs = /* GraphQL */ `
  enum AnimalCategory {
    PET
    FARM
  }

  enum RiskLevel {
    LOW
    MEDIUM
    HIGH
  }

  type Location {
    postcode: String!
    latitude: Float!
    longitude: Float!
    region: String
  }

  type DailyRisk {
    date: String!
    level: RiskLevel!
    score: Int!
    reason: String!
    "General husbandry checks for this level (FR-5.1). Empty at LOW."
    checks: [String!]!
  }

  type RiskForecast {
    riskId: ID!
    name: String!
    category: AnimalCategory!
    animals: [String!]!
    days: [DailyRisk!]!
  }

  type Forecast {
    location: Location!
    generatedAt: String!
    risks: [RiskForecast!]!
  }

  type Animal {
    id: ID!
    name: String!
    species: String!
    category: AnimalCategory!
    logs: [LogEntry!]!
  }

  type LogEntry {
    id: ID!
    date: String!
    type: String!
    note: String
    nextDueDate: String
  }

  # --- Farms, fields and livestock groups (FR-2) ---

  enum Species {
    CATTLE
    SHEEP
  }

  enum LivestockClass {
    EWES
    LAMBS
    RAMS
    DAIRY_COWS
    BEEF_CATTLE
    CALVES
  }

  enum CattleType {
    DAIRY
    BEEF
  }

  "Where a group's forecast location came from: field pin, field postcode, or farm postcode."
  enum LocationSource {
    PIN
    FIELD_POSTCODE
    FARM_POSTCODE
  }

  type Farm {
    id: ID!
    name: String!
    postcode: String!
    fields: [Field!]!
    groups: [LivestockGroup!]!
  }

  type Field {
    id: ID!
    name: String!
    postcode: String
    latitude: Float
    longitude: Float
  }

  type LivestockGroup {
    id: ID!
    name: String!
    species: Species!
    livestockClass: LivestockClass!
    headCount: Int!
    housed: Boolean!
    currentField: Field
    "Sheep only"
    lastShearingDate: String
    lambingStart: String
    lambingEnd: String
    lambsAtGrassThisSpring: Boolean!
    "Cattle only"
    cattleType: CattleType
    calvingStart: String
    calvingEnd: String
    "Newest first"
    movements: [GroupMovement!]!
    forecast: GroupForecast!
    farm: Farm!
    "Newest first (FR-6.1)"
    treatments: [Treatment!]!
    "Newest first (FR-6.6)"
    observations: [Observation!]!
    "Whether the group is in withdrawal today (FR-6.2)"
    withdrawal: WithdrawalStatus!
  }

  # --- Records (FR-6) ---

  "A treatment record. Product and withdrawal periods are typed in by the farmer from the label or vet."
  type Treatment {
    id: ID!
    date: String!
    productName: String!
    batchNumber: String
    quantityUsed: String
    animalsTreated: Int!
    administeredBy: String!
    reason: String
    meatWithdrawalDays: Int!
    milkWithdrawalDays: Int
    "First day out of meat withdrawal"
    meatWithdrawalEnds: String!
    "First day out of milk withdrawal, if a milk period was entered"
    milkWithdrawalEnds: String
    group: LivestockGroup!
  }

  type Observation {
    id: ID!
    date: String!
    type: String!
    note: String
  }

  type WithdrawalStatus {
    inWithdrawal: Boolean!
    "Latest meat withdrawal end still to come"
    meatEnds: String
    "Latest milk withdrawal end still to come"
    milkEnds: String
  }

  input RecordTreatmentInput {
    groupId: ID!
    date: String!
    productName: String!
    batchNumber: String
    quantityUsed: String
    animalsTreated: Int!
    administeredBy: String!
    reason: String
    meatWithdrawalDays: Int!
    milkWithdrawalDays: Int
  }

  # --- Briefing and tasks (FR-4, FR-5) ---

  type Briefing {
    farm: Farm!
    "UK date this briefing is for"
    date: String!
    generatedAt: String!
    "True when today's briefing couldn't be made and an earlier one is shown"
    isStale: Boolean!
    "FR-5.5: shown at the top"
    overdueTasks: [Task!]!
    "Groups with Medium or High risks in the next 7 days, most severe first"
    groups: [BriefingGroup!]!
    "Groups with nothing to flag: 'No concerns this week'"
    quietGroups: [QuietGroup!]!
    flaggedCount: Int!
  }

  type BriefingGroup {
    groupId: ID!
    groupName: String!
    fieldName: String
    items: [BriefingItem!]!
  }

  type QuietGroup {
    groupId: ID!
    groupName: String!
  }

  type BriefingItem {
    riskId: ID!
    riskName: String!
    level: RiskLevel!
    daysAffected: [AffectedDay!]!
    reason: String!
    checks: [String!]!
    "High today but not High in yesterday's briefing (FR-4.4)"
    isNew: Boolean!
  }

  type AffectedDay {
    date: String!
    level: RiskLevel!
  }

  type Task {
    id: ID!
    title: String!
    dueDate: String!
    note: String
    done: Boolean!
    overdue: Boolean!
    group: LivestockGroup!
  }

  type BriefingPreferences {
    emailEnabled: Boolean!
    "HH:MM, UK time"
    sendAt: String!
    "Send even when nothing is flagged"
    alwaysSend: Boolean!
  }

  input CreateTaskInput {
    groupId: ID!
    title: String!
    dueDate: String!
    note: String
  }

  input BriefingPreferencesInput {
    emailEnabled: Boolean!
    sendAt: String!
    alwaysSend: Boolean!
  }

  input RecordObservationInput {
    groupId: ID!
    date: String!
    type: String!
    note: String
  }

  type GroupMovement {
    id: ID!
    movedOn: String!
    fromField: Field
    toField: Field!
  }

  type ResolvedLocation {
    source: LocationSource!
    latitude: Float!
    longitude: Float!
    postcode: String
  }

  type GroupForecast {
    location: ResolvedLocation!
    generatedAt: String!
    risks: [RiskForecast!]!
  }

  input CreateFarmInput {
    name: String!
    postcode: String!
  }

  "Give a postcode, a map pin (latitude + longitude), or neither to use the farm postcode."
  input CreateFieldInput {
    farmId: ID!
    name: String!
    postcode: String
    latitude: Float
    longitude: Float
  }

  input CreateLivestockGroupInput {
    farmId: ID!
    name: String!
    species: Species!
    livestockClass: LivestockClass!
    headCount: Int!
    currentFieldId: ID
    housed: Boolean
    lastShearingDate: String
    lambingStart: String
    lambingEnd: String
    lambsAtGrassThisSpring: Boolean
    cattleType: CattleType
    calvingStart: String
    calvingEnd: String
  }

  "Omitted fields are unchanged; null clears a date or cattle type. Use moveLivestockGroup to change field."
  input UpdateLivestockGroupInput {
    name: String
    livestockClass: LivestockClass
    headCount: Int
    housed: Boolean
    lastShearingDate: String
    lambingStart: String
    lambingEnd: String
    lambsAtGrassThisSpring: Boolean
    cattleType: CattleType
    calvingStart: String
    calvingEnd: String
  }

  input MoveLivestockGroupInput {
    groupId: ID!
    toFieldId: ID!
    movedOn: String!
  }

  # --- Users (FR-8.1) ---

  type User {
    id: ID!
    email: String!
  }

  type Query {
    "The signed-in user, or null."
    me: User
    forecast(postcode: String!, category: AnimalCategory!, highExposureHabitat: Boolean): Forecast!
    animals: [Animal!]!
    animal(id: ID!): Animal
    farms: [Farm!]!
    farm(id: ID!): Farm
    livestockGroup(id: ID!): LivestockGroup
    "A farm's treatments from 'from' to 'to' inclusive, oldest first (FR-6.4)"
    treatments(farmId: ID!, from: String!, to: String!): [Treatment!]!
    "Today's stored briefing (FR-4.1, FR-4.5); null if the farm isn't yours"
    briefing(farmId: ID!): Briefing
    "Earliest due first"
    tasks(farmId: ID!): [Task!]!
    briefingPreferences(farmId: ID!): BriefingPreferences!
  }

  type Mutation {
    createAnimal(name: String!, species: String!, category: AnimalCategory!): Animal!
    addLogEntry(
      animalId: ID!
      date: String!
      type: String!
      note: String
      nextDueDate: String
    ): LogEntry!
    deleteLogEntry(id: ID!): Boolean!
    createFarm(input: CreateFarmInput!): Farm!
    createField(input: CreateFieldInput!): Field!
    createLivestockGroup(input: CreateLivestockGroupInput!): LivestockGroup!
    updateLivestockGroup(id: ID!, input: UpdateLivestockGroupInput!): LivestockGroup!
    moveLivestockGroup(input: MoveLivestockGroupInput!): GroupMovement!
    "Creates an account and signs in (sets the session cookie)."
    signUp(email: String!, password: String!): User!
    "Signs in (sets the session cookie)."
    logIn(email: String!, password: String!): User!
    "Ends the session and clears the cookie."
    logOut: Boolean!
    recordTreatment(input: RecordTreatmentInput!): Treatment!
    recordObservation(input: RecordObservationInput!): Observation!
    "Rebuilds today's briefing now"
    refreshBriefing(farmId: ID!): Briefing!
    createTask(input: CreateTaskInput!): Task!
    setTaskDone(id: ID!, done: Boolean!): Task!
    setBriefingPreferences(farmId: ID!, input: BriefingPreferencesInput!): BriefingPreferences!
  }
`;
