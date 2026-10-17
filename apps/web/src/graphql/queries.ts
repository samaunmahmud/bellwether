import { gql } from '@apollo/client';

export const FORECAST_QUERY = gql`
  query Forecast($postcode: String!, $category: AnimalCategory!, $highExposureHabitat: Boolean) {
    forecast(postcode: $postcode, category: $category, highExposureHabitat: $highExposureHabitat) {
      location {
        postcode
        region
      }
      generatedAt
      risks {
        riskId
        name
        category
        animals
        days {
          date
          level
          score
          reason
        }
      }
    }
  }
`;

const LOG_FIELDS = gql`
  fragment LogFields on LogEntry {
    id
    date
    type
    note
    nextDueDate
  }
`;

export const ANIMALS_QUERY = gql`
  query Animals {
    animals {
      id
      name
      species
      category
      postcode
      highExposureHabitat
      logs {
        ...LogFields
      }
    }
  }
  ${LOG_FIELDS}
`;

export const PET_QUERY = gql`
  query Pet($id: ID!) {
    animal(id: $id) {
      id
      name
      species
      category
      postcode
      highExposureHabitat
      remindersEnabled
      dateOfBirth
      breed
      sex
      microchip
      logs {
        ...LogFields
      }
      forecast {
        location {
          postcode
          region
        }
        generatedAt
        risks {
          riskId
          name
          category
          animals
          days {
            date
            level
            score
            reason
          }
        }
      }
    }
  }
  ${LOG_FIELDS}
`;

export const CREATE_ANIMAL = gql`
  mutation CreateAnimal(
    $name: String!
    $species: String!
    $category: AnimalCategory!
    $postcode: String
    $highExposureHabitat: Boolean
  ) {
    createAnimal(
      name: $name
      species: $species
      category: $category
      postcode: $postcode
      highExposureHabitat: $highExposureHabitat
    ) {
      id
    }
  }
`;

export const UPDATE_ANIMAL = gql`
  mutation UpdateAnimal($id: ID!, $input: UpdateAnimalInput!) {
    updateAnimal(id: $id, input: $input) {
      id
      name
      postcode
      highExposureHabitat
      remindersEnabled
      dateOfBirth
      breed
      sex
      microchip
    }
  }
`;

export const DELETE_ANIMAL = gql`
  mutation DeleteAnimal($id: ID!) {
    deleteAnimal(id: $id)
  }
`;

export const ADD_LOG_ENTRY = gql`
  mutation AddLogEntry(
    $animalId: ID!
    $date: String!
    $type: String!
    $note: String
    $nextDueDate: String
    $weightKg: Float
  ) {
    addLogEntry(
      animalId: $animalId
      date: $date
      type: $type
      note: $note
      nextDueDate: $nextDueDate
      weightKg: $weightKg
    ) {
      id
    }
  }
`;

export const UPDATE_LOG_ENTRY = gql`
  mutation UpdateLogEntry($id: ID!, $input: UpdateLogEntryInput!) {
    updateLogEntry(id: $id, input: $input) {
      ...LogFields
    }
  }
  ${LOG_FIELDS}
`;

export const DELETE_LOG_ENTRY = gql`
  mutation DeleteLogEntry($id: ID!) {
    deleteLogEntry(id: $id)
  }
`;
