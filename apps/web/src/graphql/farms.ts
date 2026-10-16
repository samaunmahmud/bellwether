import { gql } from '@apollo/client';

export const FARMS_QUERY = gql`
  query Farms {
    farms {
      id
      name
      postcode
      myRole
    }
  }
`;

export const FARM_QUERY = gql`
  query Farm($id: ID!) {
    farm(id: $id) {
      id
      name
      postcode
      myRole
      fields {
        id
        name
        postcode
        latitude
        longitude
      }
      groups {
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
        withdrawal {
          inWithdrawal
          meatEnds
          milkEnds
        }
        cattleType
        calvingStart
        calvingEnd
        movements {
          id
          movedOn
          fromField {
            id
            name
          }
          toField {
            id
            name
          }
        }
      }
    }
  }
`;

export const CREATE_FARM = gql`
  mutation CreateFarm($input: CreateFarmInput!) {
    createFarm(input: $input) {
      id
      name
      postcode
    }
  }
`;

export const CREATE_FIELD = gql`
  mutation CreateField($input: CreateFieldInput!) {
    createField(input: $input) {
      id
    }
  }
`;

export const CREATE_GROUP = gql`
  mutation CreateLivestockGroup($input: CreateLivestockGroupInput!) {
    createLivestockGroup(input: $input) {
      id
    }
  }
`;

export const MOVE_GROUP = gql`
  mutation MoveLivestockGroup($input: MoveLivestockGroupInput!) {
    moveLivestockGroup(input: $input) {
      id
    }
  }
`;

// Farm settings: details, fields, archived groups and deleting the farm

const FIELD_FIELDS = gql`
  fragment SettingsFieldFields on Field {
    id
    name
    postcode
    latitude
    longitude
    archivedOn
  }
`;

export const FARM_SETTINGS_QUERY = gql`
  query FarmSettings($id: ID!) {
    farm(id: $id) {
      id
      name
      postcode
      myRole
      fields {
        ...SettingsFieldFields
      }
      archivedFields {
        ...SettingsFieldFields
      }
      archivedGroups {
        id
        name
        archivedOn
        archiveReason
      }
    }
  }
  ${FIELD_FIELDS}
`;

export const UPDATE_FARM = gql`
  mutation UpdateFarm($id: ID!, $input: UpdateFarmInput!) {
    updateFarm(id: $id, input: $input) {
      id
      name
      postcode
    }
  }
`;

export const DELETE_FARM = gql`
  mutation DeleteFarm($id: ID!, $confirmName: String!) {
    deleteFarm(id: $id, confirmName: $confirmName)
  }
`;

export const UPDATE_FIELD = gql`
  mutation UpdateField($id: ID!, $input: UpdateFieldInput!) {
    updateField(id: $id, input: $input) {
      id
    }
  }
`;

export const SET_FIELD_ARCHIVED = gql`
  mutation SetFieldArchived($id: ID!, $archived: Boolean!) {
    setFieldArchived(id: $id, archived: $archived) {
      id
      archivedOn
    }
  }
`;

export const UPDATE_GROUP = gql`
  mutation UpdateGroup($id: ID!, $input: UpdateLivestockGroupInput!) {
    updateLivestockGroup(id: $id, input: $input) {
      id
    }
  }
`;

export const ARCHIVE_GROUP = gql`
  mutation ArchiveGroup($id: ID!, $input: ArchiveLivestockGroupInput!) {
    archiveLivestockGroup(id: $id, input: $input) {
      id
      archivedOn
    }
  }
`;

export const RESTORE_GROUP = gql`
  mutation RestoreGroup($id: ID!) {
    restoreLivestockGroup(id: $id) {
      id
      archivedOn
    }
  }
`;
