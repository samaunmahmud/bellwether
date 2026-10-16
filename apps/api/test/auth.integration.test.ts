import { describe, expect, it } from 'vitest';
import { buildTestApp, TEST_PASSWORD } from './fakes';

const SIGN_UP = /* GraphQL */ `
  mutation ($email: String!, $password: String!) {
    signUp(email: $email, password: $password) {
      id
      email
    }
  }
`;

const LOG_IN = /* GraphQL */ `
  mutation ($email: String!, $password: String!) {
    logIn(email: $email, password: $password) {
      email
    }
  }
`;

const ME = /* GraphQL */ `
  query {
    me {
      email
    }
  }
`;

const cookieOf = (response: Response) => response.headers.get('set-cookie') ?? '';
const sessionPair = (setCookie: string) => setCookie.split(';')[0]!;

describe('sign-up, log-in and log-out (FR-8.1)', () => {
  it('signs up, sets an httpOnly session cookie, and knows who you are', async () => {
    const { send, withCookie } = buildTestApp();
    const { body, response } = await send(SIGN_UP, {
      email: 'Ann@Example.com',
      password: TEST_PASSWORD,
    });

    expect(body.errors).toBeUndefined();
    expect(body.data).toEqual({ signUp: { id: expect.any(String), email: 'ann@example.com' } });
    const setCookie = cookieOf(response);
    expect(setCookie).toMatch(
      /^bw_session=[\w-]{43}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000$/,
    );

    const me = await withCookie(sessionPair(setCookie))(ME);
    expect(me.data).toEqual({ me: { email: 'ann@example.com' } });
  });

  it('returns null for me when not logged in, or with an unknown cookie', async () => {
    const { gql, withCookie } = buildTestApp();
    expect((await gql(ME)).data).toEqual({ me: null });
    expect((await withCookie('bw_session=forged')(ME)).data).toEqual({ me: null });
  });

  it('logs in with the right password and sets a new cookie', async () => {
    const { send, signedIn } = buildTestApp();
    await signedIn('ann@example.com');
    const { body, response } = await send(LOG_IN, {
      email: 'ann@example.com',
      password: TEST_PASSWORD,
    });
    expect(body.data).toEqual({ logIn: { email: 'ann@example.com' } });
    expect(cookieOf(response)).toMatch(/^bw_session=/);
  });

  it('refuses a wrong password without setting a cookie', async () => {
    const { send, signedIn } = buildTestApp();
    await signedIn('ann@example.com');
    const { body, response } = await send(LOG_IN, {
      email: 'ann@example.com',
      password: 'not the password',
    });
    expect(body.errors?.[0]).toMatchObject({
      message: 'Email or password is incorrect',
      extensions: { code: 'BAD_CREDENTIALS' },
    });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('logs out: clears the cookie and ends the session on the server', async () => {
    const { send } = buildTestApp();
    const signUp = await send(SIGN_UP, { email: 'ann@example.com', password: TEST_PASSWORD });
    const cookie = sessionPair(cookieOf(signUp.response));

    const logOut = await send(`mutation { logOut }`, {}, cookie);
    expect(logOut.body.data).toEqual({ logOut: true });
    expect(cookieOf(logOut.response)).toMatch(/^bw_session=; .*Max-Age=0/);

    // The old cookie no longer works, even if a client keeps sending it.
    expect((await send(ME, {}, cookie)).body.data).toEqual({ me: null });
  });

  it('marks the cookie Secure when configured for production', async () => {
    const { send } = buildTestApp({ secureCookies: true });
    const { response } = await send(SIGN_UP, {
      email: 'ann@example.com',
      password: TEST_PASSWORD,
    });
    expect(cookieOf(response)).toMatch(/; Secure$/);
  });

  it('reports bad sign-up input clearly', async () => {
    const { gql, signedIn } = buildTestApp();
    await signedIn('ann@example.com');
    for (const variables of [
      { email: 'ann@example.com', password: TEST_PASSWORD },
      { email: 'not-an-email', password: TEST_PASSWORD },
      { email: 'bob@example.com', password: 'short' },
    ]) {
      expect((await gql(SIGN_UP, variables)).errors?.[0]?.extensions?.code).toBe('BAD_INPUT');
    }
  });
});
