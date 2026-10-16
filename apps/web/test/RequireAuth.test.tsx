import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { RequireAuth } from '../src/components/RequireAuth';
import { ME_QUERY } from '../src/graphql/auth';
import { routerFuture } from '../src/routerFuture';

function LoginStub() {
  const location = useLocation();
  return <p>Login page {location.search}</p>;
}

function renderAt(me: { id: string; email: string } | null) {
  const mocks: MockedResponse[] = [
    { request: { query: ME_QUERY }, result: { data: { me: me && { __typename: 'User', ...me } } } },
  ];
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/farms']} future={routerFuture}>
        <Routes>
          <Route path="/login" element={<LoginStub />} />
          <Route
            path="/farms"
            element={
              <RequireAuth>
                <p>Secret farms</p>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('RequireAuth', () => {
  it('shows the page to a signed-in user', async () => {
    renderAt({ id: 'u1', email: 'ann@example.com' });
    expect(screen.getByText('Checking your account…')).toBeInTheDocument();
    expect(await screen.findByText('Secret farms')).toBeInTheDocument();
  });

  it('sends anyone else to log in, then back to where they were going', async () => {
    renderAt(null);
    expect(await screen.findByText('Login page ?next=%2Ffarms')).toBeInTheDocument();
    expect(screen.queryByText('Secret farms')).not.toBeInTheDocument();
  });
});
