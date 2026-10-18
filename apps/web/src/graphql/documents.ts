import { gql } from '@apollo/client';

// v4: stored documents for farms and pets

const DOCUMENT_FIELDS = gql`
  fragment DocumentFields on Document {
    id
    kind
    title
    fileName
    mimeType
    sizeBytes
    documentDate
    expiresOn
    daysToExpiry
    notes
    uploadedAt
    farmName
    petName
    group {
      id
      name
    }
    taggedAnimal {
      id
      tag
    }
  }
`;

export const FARM_DOCUMENTS_QUERY = gql`
  query FarmDocuments($farmId: ID!) {
    farm(id: $farmId) {
      id
      name
      myRole
      groups {
        id
        name
      }
    }
    taggedAnimals(farmId: $farmId) {
      id
      tag
      status
    }
    documents(farmId: $farmId) {
      ...DocumentFields
    }
  }
  ${DOCUMENT_FIELDS}
`;

export const PET_DOCUMENTS_QUERY = gql`
  query PetDocuments($petId: ID!) {
    documents(petId: $petId) {
      ...DocumentFields
    }
  }
  ${DOCUMENT_FIELDS}
`;

export const EXPIRING_DOCUMENTS_QUERY = gql`
  query ExpiringDocuments {
    expiringDocuments {
      ...DocumentFields
    }
  }
  ${DOCUMENT_FIELDS}
`;

/** The file itself. Never kept for offline use (see keepsOffline). */
export const DOCUMENT_FILE = gql`
  query DocumentFile($id: ID!) {
    documentFile(id: $id) {
      fileName
      mimeType
      contentBase64
    }
  }
`;

export const ADD_DOCUMENT = gql`
  mutation AddDocument($input: DocumentInput!) {
    addDocument(input: $input) {
      ...DocumentFields
    }
  }
  ${DOCUMENT_FIELDS}
`;

export const UPDATE_DOCUMENT = gql`
  mutation UpdateDocument($id: ID!, $input: UpdateDocumentInput!) {
    updateDocument(id: $id, input: $input) {
      ...DocumentFields
    }
  }
  ${DOCUMENT_FIELDS}
`;

export const DELETE_DOCUMENT = gql`
  mutation DeleteDocument($id: ID!) {
    deleteDocument(id: $id)
  }
`;
