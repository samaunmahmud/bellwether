import { gql } from '@apollo/client';

export const FARMS_QUERY = gql`
  query Farms {
    farms {
      id
      name
      postcode
    }
  }
`;

export const FARM_QUERY = gql`
  query Farm($id: ID!) {
    farm(id: $id) {
      id
      name
      postcode
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
