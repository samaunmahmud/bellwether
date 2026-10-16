import { gql } from '@apollo/client';

const TREATMENT_FIELDS = gql`
  fragment TreatmentFields on Treatment {
    id
    date
    productName
    batchNumber
    quantityUsed
    animalsTreated
    administeredBy
    reason
    meatWithdrawalDays
    milkWithdrawalDays
    meatWithdrawalEnds
    milkWithdrawalEnds
    group {
      id
      name
    }
  }
`;

export const GROUP_QUERY = gql`
  ${TREATMENT_FIELDS}
  query LivestockGroup($id: ID!) {
    livestockGroup(id: $id) {
      id
      name
      species
      livestockClass
      headCount
      farm {
        id
        name
      }
      withdrawal {
        inWithdrawal
        meatEnds
        milkEnds
      }
      treatments {
        ...TreatmentFields
      }
      observations {
        id
        date
        type
        note
      }
    }
  }
`;

export const RECORD_TREATMENT = gql`
  mutation RecordTreatment($input: RecordTreatmentInput!) {
    recordTreatment(input: $input) {
      id
    }
  }
`;

export const RECORD_OBSERVATION = gql`
  mutation RecordObservation($input: RecordObservationInput!) {
    recordObservation(input: $input) {
      id
    }
  }
`;

export const TREATMENTS_QUERY = gql`
  ${TREATMENT_FIELDS}
  query Treatments($farmId: ID!, $from: String!, $to: String!) {
    treatments(farmId: $farmId, from: $from, to: $to) {
      ...TreatmentFields
    }
  }
`;
