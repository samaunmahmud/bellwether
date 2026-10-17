import { gql } from '@apollo/client';

export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
    }
  }
`;

export const SIGN_UP = gql`
  mutation SignUp($email: String!, $password: String!) {
    signUp(email: $email, password: $password) {
      id
      email
    }
  }
`;

export const LOG_IN = gql`
  mutation LogIn($email: String!, $password: String!) {
    logIn(email: $email, password: $password) {
      id
      email
    }
  }
`;

export const LOG_OUT = gql`
  mutation LogOut {
    logOut
  }
`;

/** v3.2: a new account full of example data, signed in straight away */
export const START_DEMO = gql`
  mutation StartDemo {
    startDemo {
      id
      email
    }
  }
`;
