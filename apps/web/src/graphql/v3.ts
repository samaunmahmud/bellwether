import { gql } from '@apollo/client';

// v3: dashboard, map, register, medicines, calendar and outlook

const RISK_DAYS = gql`
  fragment HeatmapRisk on RiskForecast {
    riskId
    name
    days {
      date
      level
      reason
    }
  }
`;

export const DASHBOARD_QUERY = gql`
  query Dashboard($id: ID!) {
    farm(id: $id) {
      id
      name
      postcode
      cphNumber
      flockMark
      myRole
      stats {
        totalHead
        sheep
        cattle
        bornAlive
        bornDead
        deaths
        movedOn
        movedOff
        mortalityPct
        birthSurvivalPct
        groupsInWithdrawal
        openTasks
        overdueTasks
      }
      alerts {
        level
        title
        detail
        link
      }
      activity(limit: 12) {
        date
        kind
        title
        detail
        groupId
        groupName
      }
      weather {
        date
        tempMaxC
        tempMinC
        precipitationMm
      }
      groups {
        id
        name
        species
        headCount
        forecast {
          risks {
            ...HeatmapRisk
          }
        }
      }
    }
  }
  ${RISK_DAYS}
`;

export const OUTLOOK_QUERY = gql`
  query Outlook($id: ID!) {
    farm(id: $id) {
      id
      name
      weather {
        date
        tempMeanC
        tempMaxC
        tempMinC
        humidityMeanPct
        precipitationMm
      }
      groups {
        id
        name
        forecast {
          risks {
            ...HeatmapRisk
          }
        }
      }
    }
  }
  ${RISK_DAYS}
`;

export const MAP_QUERY = gql`
  query FarmMap($id: ID!) {
    farm(id: $id) {
      id
      name
      myRole
      location {
        latitude
        longitude
      }
      fields {
        id
        name
        postcode
        latitude
        longitude
        grazing {
          status
          days
          groups
        }
      }
    }
  }
`;

export const SET_FIELD_PIN = gql`
  mutation SetFieldPin($id: ID!, $input: UpdateFieldInput!) {
    updateField(id: $id, input: $input) {
      id
      latitude
      longitude
    }
  }
`;

const EVENT_FIELDS = gql`
  fragment RegisterEventFields on RegisterEvent {
    id
    kind
    date
    count
    bornDead
    value
    otherParty
    reference
    cause
    note
    recordedBy
    voided
    voidReason
    group {
      id
      name
    }
  }
`;

export const REGISTER_QUERY = gql`
  query Register($farmId: ID!) {
    farm(id: $farmId) {
      id
      name
      cphNumber
      flockMark
      myRole
      groups {
        id
        name
        headCount
      }
    }
    holdingRegister(farmId: $farmId) {
      headCountAfter
      event {
        ...RegisterEventFields
      }
    }
    registerEvents(farmId: $farmId) {
      ...RegisterEventFields
    }
  }
  ${EVENT_FIELDS}
`;

export const RECORD_REGISTER_EVENT = gql`
  mutation RecordRegisterEvent($input: RegisterEventInput!) {
    recordRegisterEvent(input: $input) {
      id
      group {
        id
        headCount
      }
    }
  }
`;

export const VOID_REGISTER_EVENT = gql`
  mutation VoidRegisterEvent($id: ID!, $reason: String!) {
    voidRegisterEvent(id: $id, reason: $reason) {
      id
      voided
    }
  }
`;

const MEDICINE_FIELDS = gql`
  fragment MedicineFields on MedicineItem {
    id
    productName
    batchNumber
    quantity
    expiryDate
    supplier
    purchasedOn
    meatWithdrawalDays
    milkWithdrawalDays
    note
    finishedOn
    status
  }
`;

export const MEDICINES_QUERY = gql`
  query Medicines($farmId: ID!) {
    farm(id: $farmId) {
      id
      name
      myRole
    }
    medicines(farmId: $farmId) {
      ...MedicineFields
    }
  }
  ${MEDICINE_FIELDS}
`;

/** Just the cabinet, for filling in the treatment form. */
export const CABINET_QUERY = gql`
  query Cabinet($farmId: ID!) {
    medicines(farmId: $farmId) {
      ...MedicineFields
    }
  }
  ${MEDICINE_FIELDS}
`;

export const ADD_MEDICINE = gql`
  mutation AddMedicine($farmId: ID!, $input: MedicineInput!) {
    addMedicine(farmId: $farmId, input: $input) {
      id
    }
  }
`;

export const UPDATE_MEDICINE = gql`
  mutation UpdateMedicine($id: ID!, $input: MedicineInput!) {
    updateMedicine(id: $id, input: $input) {
      id
      status
      finishedOn
    }
  }
`;

export const DELETE_MEDICINE = gql`
  mutation DeleteMedicine($id: ID!) {
    deleteMedicine(id: $id)
  }
`;

export const CALENDAR_QUERY = gql`
  query FarmCalendar($id: ID!) {
    farm(id: $id) {
      id
      name
      groups {
        id
        name
        species
        lambingStart
        lambingEnd
        calvingStart
        calvingEnd
        withdrawal {
          meatEnds
          milkEnds
        }
      }
    }
    tasks(farmId: $id) {
      id
      title
      dueDate
      done
      overdue
      group {
        id
        name
      }
    }
    registerEvents(farmId: $id) {
      ...RegisterEventFields
    }
    medicines(farmId: $id) {
      id
      productName
      expiryDate
      status
    }
  }
  ${EVENT_FIELDS}
`;

export const GROUP_PERFORMANCE_QUERY = gql`
  query GroupPerformance($id: ID!) {
    livestockGroup(id: $id) {
      id
      name
      weights {
        date
        averageKg
        dailyGainKg
      }
      registerEvents {
        ...RegisterEventFields
      }
    }
  }
  ${EVENT_FIELDS}
`;

export const CREATE_DEMO_FARM = gql`
  mutation CreateDemoFarm($postcode: String!) {
    createDemoFarm(postcode: $postcode) {
      id
      name
    }
  }
`;

/** For the command palette: the current farm's groups and fields. */
export const PALETTE_QUERY = gql`
  query Palette {
    farms {
      id
      name
      groups {
        id
        name
      }
      fields {
        id
        name
      }
    }
    animals {
      id
      name
      species
    }
  }
`;

/** v3: a pet's health plan, weights and walk planner. */
export const PET_HEALTH_QUERY = gql`
  query PetHealth($id: ID!) {
    animal(id: $id) {
      id
      name
      species
      logs {
        id
        date
        type
        nextDueDate
        weightKg
      }
      walkPlanner {
        date
        bestTimes
        hours {
          time
          tempC
          level
        }
      }
    }
  }
`;
