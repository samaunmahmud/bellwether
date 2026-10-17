import { gql } from '@apollo/client';

// v4: contacts and emergency numbers

const CONTACT_FIELDS = gql`
  fragment ContactFields on Contact {
    id
    kind
    name
    phone
    emergencyPhone
    email
    website
    address
    notes
    farmName
  }
`;

export const CONTACTS_QUERY = gql`
  query Contacts($farmId: ID) {
    contacts(farmId: $farmId) {
      ...ContactFields
    }
  }
  ${CONTACT_FIELDS}
`;

export const FARM_CONTACTS_QUERY = gql`
  query FarmContacts($farmId: ID!) {
    farm(id: $farmId) {
      id
      name
      postcode
      myRole
    }
    contacts(farmId: $farmId) {
      ...ContactFields
    }
  }
  ${CONTACT_FIELDS}
`;

export const EMERGENCY_QUERY = gql`
  query Emergency {
    emergencyContacts {
      ...ContactFields
    }
    farms {
      id
      name
      postcode
    }
    animals {
      id
      name
      postcode
    }
  }
  ${CONTACT_FIELDS}
`;

export const ADD_CONTACT = gql`
  mutation AddContact($input: ContactInput!) {
    addContact(input: $input) {
      ...ContactFields
    }
  }
  ${CONTACT_FIELDS}
`;

export const UPDATE_CONTACT = gql`
  mutation UpdateContact($id: ID!, $input: ContactInput!) {
    updateContact(id: $id, input: $input) {
      ...ContactFields
    }
  }
  ${CONTACT_FIELDS}
`;

export const DELETE_CONTACT = gql`
  mutation DeleteContact($id: ID!) {
    deleteContact(id: $id)
  }
`;
