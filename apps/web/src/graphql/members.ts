import { gql } from '@apollo/client';

// FR-8.2: sharing a farm

export const PEOPLE_QUERY = gql`
  query People($id: ID!) {
    farm(id: $id) {
      id
      name
      myRole
      members {
        userId
        email
        role
        isMe
      }
      invites {
        id
        email
        role
      }
    }
  }
`;

export const MY_INVITES_QUERY = gql`
  query MyInvites {
    myInvites {
      id
      farmName
      role
      invitedBy
    }
  }
`;

export const INVITE_MEMBER = gql`
  mutation InviteMember($farmId: ID!, $email: String!, $role: FarmRole!) {
    inviteMember(farmId: $farmId, email: $email, role: $role) {
      id
      email
      role
    }
  }
`;

export const CANCEL_INVITE = gql`
  mutation CancelInvite($id: ID!) {
    cancelInvite(id: $id)
  }
`;

export const ACCEPT_INVITE = gql`
  mutation AcceptInvite($id: ID!) {
    acceptInvite(id: $id) {
      id
      name
    }
  }
`;

export const DECLINE_INVITE = gql`
  mutation DeclineInvite($id: ID!) {
    declineInvite(id: $id)
  }
`;

export const SET_MEMBER_ROLE = gql`
  mutation SetMemberRole($farmId: ID!, $userId: ID!, $role: FarmRole!) {
    setMemberRole(farmId: $farmId, userId: $userId, role: $role)
  }
`;

export const REMOVE_MEMBER = gql`
  mutation RemoveMember($farmId: ID!, $userId: ID!) {
    removeMember(farmId: $farmId, userId: $userId)
  }
`;
