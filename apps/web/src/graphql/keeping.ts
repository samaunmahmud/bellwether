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

// v4: individually tagged animals

const TAGGED_FIELDS = gql`
  fragment TaggedFields on TaggedAnimal {
    id
    tag
    name
    species
    sex
    breed
    dateOfBirth
    ageMonths
    status
    statusDate
    notes
    group {
      id
      name
    }
  }
`;

export const TAGGED_ANIMALS_QUERY = gql`
  query TaggedAnimals($farmId: ID!) {
    farm(id: $farmId) {
      id
      name
      myRole
      groups {
        id
        name
        species
      }
    }
    taggedAnimals(farmId: $farmId) {
      ...TaggedFields
    }
  }
  ${TAGGED_FIELDS}
`;

export const ADD_TAGGED_ANIMAL = gql`
  mutation AddTaggedAnimal($input: TaggedAnimalInput!) {
    addTaggedAnimal(input: $input) {
      ...TaggedFields
    }
  }
  ${TAGGED_FIELDS}
`;

export const UPDATE_TAGGED_ANIMAL = gql`
  mutation UpdateTaggedAnimal($id: ID!, $input: UpdateTaggedAnimalInput!) {
    updateTaggedAnimal(id: $id, input: $input) {
      ...TaggedFields
    }
  }
  ${TAGGED_FIELDS}
`;

export const DELETE_TAGGED_ANIMAL = gql`
  mutation DeleteTaggedAnimal($id: ID!) {
    deleteTaggedAnimal(id: $id)
  }
`;

export const GROUP_TAGGED_QUERY = gql`
  query GroupTagged($id: ID!) {
    livestockGroup(id: $id) {
      id
      taggedAnimals {
        id
        tag
        name
        ageMonths
      }
    }
  }
`;
