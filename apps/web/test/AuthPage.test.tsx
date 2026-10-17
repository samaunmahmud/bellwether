import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LOG_IN, ME_QUERY, SIGN_UP, START_DEMO } from '../src/graphql/auth';
import { AuthPage } from '../src/pages/AuthPage';
import { routerFuture } from '../src/routerFuture';

const user = { __typename: 'User', id: 'u1', email: 'ann@example.com' };
const credentials = { email: 'ann@example.com', password: 'correct horse battery' };

function renderAt(url: string, mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={[url]} future={routerFuture}>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/farms" element={<p>Farms page</p>} />
          <Route path="/farms/:id" element={<p>One farm page</p>} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

async function submit(button: string) {
  await userEvent.type(screen.getByLabelText('Email'), credentials.email);
  await userEvent.type(screen.getByLabelText('Password'), credentials.password);
  await userEvent.click(screen.getByRole('button', { name: button }));
}

const meMock: MockedResponse = { request: { query: ME_QUERY }, result: { data: { me: user } } };

describe('AuthPage (FR-8.1)', () => {
  it('logs in and goes back to the page that asked for it', async () => {
    renderAt('/login?next=%2Ffarms%2Fa', [
      { request: { query: LOG_IN, variables: credentials }, result: { data: { logIn: user } } },
      meMock,
    ]);
    await submit('Log in');
    expect(await screen.findByText('One farm page')).toBeInTheDocument();
  });

  it('signs up and goes to My farms', async () => {
    renderAt('/signup', [
      { request: { query: SIGN_UP, variables: credentials }, result: { data: { signUp: user } } },
      meMock,
    ]);
    await submit('Create account');
    expect(await screen.findByText('Farms page')).toBeInTheDocument();
  });

  it('ignores a "next" link that points to another site', async () => {
    renderAt('/login?next=%2F%2Fevil.example', [
      { request: { query: LOG_IN, variables: credentials }, result: { data: { logIn: user } } },
      meMock,
    ]);
    await submit('Log in');
    expect(await screen.findByText('Farms page')).toBeInTheDocument();
  });

  it('links between log in and sign up, keeping "next"', () => {
    renderAt('/login?next=%2Ffarms', []);
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/signup?next=%2Ffarms',
    );
  });

  it('opens a demo account with one click, saying what it is building', async () => {
    renderAt('/login', [
      {
        request: { query: START_DEMO },
        delay: 50,
        result: { data: { startDemo: { ...user, email: 'demo-1a2b3c4d@example.com' } } },
      },
      meMock,
    ]);
    await userEvent.click(screen.getByRole('button', { name: /Explore a demo account/ }));
    expect(screen.getByRole('button', { name: /Building your demo/ })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/Fellside Farm|dairy|pets|team/i);
    expect(await screen.findByText('Farms page')).toBeInTheDocument();
  });

  it('says so if the demo can’t be built', async () => {
    renderAt('/login', [
      {
        request: { query: START_DEMO },
        result: { errors: [{ message: 'Demo accounts are turned off on this server' }] },
      },
    ]);
    await userEvent.click(screen.getByRole('button', { name: /Explore a demo account/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('turned off');
  });

  it('switches between log in and sign up with tabs', async () => {
    renderAt('/login', []);
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('link', { name: 'Create account' }));
    expect(await screen.findByRole('button', { name: 'Create account' })).toBeInTheDocument();
  });
});
