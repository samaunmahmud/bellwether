import { gql } from '@apollo/client';

// v4.2: links to a farm's CCTV viewers

const CAMERA_FIELDS = gql`
  fragment CameraFields on Camera {
    id
    name
    url
    notes
    field {
      id
      name
    }
    group {
      id
      name
    }
  }
`;

export const FARM_CAMERAS_QUERY = gql`
  query FarmCameras($farmId: ID!) {
    farm(id: $farmId) {
      id
      name
      myRole
      fields {
        id
        name
      }
      groups {
        id
        name
        headCount
      }
    }
    cameras(farmId: $farmId) {
      ...CameraFields
    }
  }
  ${CAMERA_FIELDS}
`;

export const ADD_CAMERA = gql`
  mutation AddCamera($input: CameraInput!) {
    addCamera(input: $input) {
      ...CameraFields
    }
  }
  ${CAMERA_FIELDS}
`;

export const UPDATE_CAMERA = gql`
  mutation UpdateCamera($id: ID!, $input: UpdateCameraInput!) {
    updateCamera(id: $id, input: $input) {
      ...CameraFields
    }
  }
  ${CAMERA_FIELDS}
`;

export const DELETE_CAMERA = gql`
  mutation DeleteCamera($id: ID!) {
    deleteCamera(id: $id)
  }
`;
