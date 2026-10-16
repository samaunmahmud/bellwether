import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NavBar } from '../src/components/NavBar';
import { LOG_OUT, ME_QUERY } from '../src/graphql/auth';
import { routerFuture } from '../src/routerFuture';

const user = { __typename: 'User', id: 'u1', email: 'ann@example.com' };

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter future={routerFuture}>
        <NavBar />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('NavBar', () => {
  it('offers to log in when nobody is signed in', async () => {
    renderWith([{ request: { query: ME_QUERY }, result: { data: { me: null } } }]);
    expect(await screen.findByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: 'My farms' })).not.toBeInTheDocument();
  });

  it('shows the signed-in user, their pages and log out', async () => {
    renderWith([{ request: { query: ME_QUERY }, result: { data: { me: user } } }]);
    expect(await screen.findByText('ann@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My farms' })).toHaveAttribute('href', '/farms');
    expect(screen.getByRole('link', { name: 'My pets' })).toHaveAttribute('href', '/animals');
  });

  it('logs out and goes back to signed-out links', async () => {
    renderWith([
      { request: { query: ME_QUERY }, result: { data: { me: user } } },
      { request: { query: LOG_OUT }, result: { data: { logOut: true } } },
      { request: { query: ME_QUERY }, result: { data: { me: null } } },
    ]);
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('link', { name: 'Log in' })).toBeInTheDocument();
  });
});
