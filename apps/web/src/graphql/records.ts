import { gql } from '@apollo/client';

const HISTORY_FIELDS = gql`
  fragment HistoryFields on RecordRevision {
    id
    action
    at
    by
    reason
    changes {
      field
      from
      to
    }
  }
`;

const TREATMENT_FIELDS = gql`
  ${HISTORY_FIELDS}
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
    voided
    voidReason
    history {
      ...HistoryFields
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
      housed
      currentField {
        id
        name
      }
      lastShearingDate
      lambingStart
      lambingEnd
      lambsAtGrassThisSpring
      cattleType
      calvingStart
      calvingEnd
      archivedOn
      archiveReason
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
        voided
        voidReason
        history {
          ...HistoryFields
        }
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

// FR-6.5: corrections and voids. The page refetches the group, so only ids come back.

export const CORRECT_TREATMENT = gql`
  mutation CorrectTreatment($id: ID!, $input: CorrectTreatmentInput!, $reason: String!) {
    correctTreatment(id: $id, input: $input, reason: $reason) {
      id
    }
  }
`;

export const VOID_TREATMENT = gql`
  mutation VoidTreatment($id: ID!, $reason: String!) {
    voidTreatment(id: $id, reason: $reason) {
      id
    }
  }
`;

export const CORRECT_OBSERVATION = gql`
  mutation CorrectObservation($id: ID!, $input: CorrectObservationInput!, $reason: String!) {
    correctObservation(id: $id, input: $input, reason: $reason) {
      id
    }
  }
`;

export const VOID_OBSERVATION = gql`
  mutation VoidObservation($id: ID!, $reason: String!) {
    voidObservation(id: $id, reason: $reason) {
      id
    }
  }
`;
