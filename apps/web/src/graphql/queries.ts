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

export const ANIMALS_QUERY = gql`
  query Animals {
    animals {
      id
      name
      species
      category
      logs {
        id
        date
        type
        note
        nextDueDate
      }
    }
  }
`;

export const CREATE_ANIMAL = gql`
  mutation CreateAnimal($name: String!, $species: String!, $category: AnimalCategory!) {
    createAnimal(name: $name, species: $species, category: $category) {
      id
    }
  }
`;

export const ADD_LOG_ENTRY = gql`
  mutation AddLogEntry(
    $animalId: ID!
    $date: String!
    $type: String!
    $note: String
    $nextDueDate: String
  ) {
    addLogEntry(
      animalId: $animalId
      date: $date
      type: $type
      note: $note
      nextDueDate: $nextDueDate
    ) {
      id
    }
  }
`;

export const DELETE_LOG_ENTRY = gql`
  mutation DeleteLogEntry($id: ID!) {
    deleteLogEntry(id: $id)
  }
`;
