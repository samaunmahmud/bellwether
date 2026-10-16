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

  type Query {
    forecast(postcode: String!, category: AnimalCategory!, highExposureHabitat: Boolean): Forecast!
    animals: [Animal!]!
    animal(id: ID!): Animal
    farms: [Farm!]!
    farm(id: ID!): Farm
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
  }
`;
