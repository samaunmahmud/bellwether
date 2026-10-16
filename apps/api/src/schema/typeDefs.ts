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

  type Query {
    forecast(postcode: String!, category: AnimalCategory!, highExposureHabitat: Boolean): Forecast!
    animals: [Animal!]!
    animal(id: ID!): Animal
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
  }
`;
