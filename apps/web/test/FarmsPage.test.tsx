import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CREATE_DEMO_FARM } from '../src/graphql/v3';
import { CREATE_FARM, FARMS_QUERY } from '../src/graphql/farms';
import { ACCEPT_INVITE, MY_INVITES_QUERY } from '../src/graphql/members';
import { FarmsPage } from '../src/pages/FarmsPage';
import { routerFuture } from '../src/routerFuture';

const farm = (id: string, name: string, myRole = 'OWNER') => ({
  __typename: 'Farm',
  id,
  name,
  postcode: 'UB8 3PH',
  myRole,
});

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter future={routerFuture}>
        <FarmsPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('FarmsPage (FR-2.1)', () => {
  it('lists the user’s farms as links', async () => {
    renderWith([
      { request: { query: FARMS_QUERY }, result: { data: { farms: [farm('a', 'Hill Farm')] } } },
    ]);
    expect(screen.getByText('Loading farms…')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /^Hill Farm/ })).toHaveAttribute(
      'href',
      '/farms/a',
    );
  });

  it('links straight to each farm’s morning briefing', async () => {
    renderWith([
      { request: { query: FARMS_QUERY }, result: { data: { farms: [farm('a', 'Hill Farm')] } } },
    ]);
    expect(await screen.findByRole('link', { name: 'Briefing for Hill Farm' })).toHaveAttribute(
      'href',
      '/farms/a/briefing',
    );
  });

  it('invites a first farm when there are none', async () => {
    renderWith([{ request: { query: FARMS_QUERY }, result: { data: { farms: [] } } }]);
    expect(await screen.findByText(/no farms yet/i)).toBeInTheDocument();
  });

  it('creates a farm and shows it', async () => {
    renderWith([
      { request: { query: FARMS_QUERY }, result: { data: { farms: [] } } },
      {
        request: {
          query: CREATE_FARM,
          variables: { input: { name: 'Hill Farm', postcode: 'ub8 3ph' } },
        },
        result: { data: { createFarm: farm('a', 'Hill Farm') } },
      },
      { request: { query: FARMS_QUERY }, result: { data: { farms: [farm('a', 'Hill Farm')] } } },
    ]);

    await screen.findByText(/no farms yet/i);
    await userEvent.type(screen.getByLabelText('Farm name'), 'Hill Farm');
    await userEvent.type(screen.getByLabelText('Main postcode'), 'ub8 3ph');
    await userEvent.click(screen.getByRole('button', { name: 'Add farm' }));

    expect(await screen.findByRole('link', { name: /^Hill Farm/ })).toBeInTheDocument();
  });

  it('shows a clear error, e.g. for an unknown postcode', async () => {
    renderWith([
      { request: { query: FARMS_QUERY }, result: { data: { farms: [] } } },
      {
        request: {
          query: CREATE_FARM,
          variables: { input: { name: 'Hill Farm', postcode: 'ZZ1 1ZZ' } },
        },
        result: { errors: [{ message: 'Postcode ZZ1 1ZZ was not found' }] },
      },
    ]);

    await screen.findByText(/no farms yet/i);
    await userEvent.type(screen.getByLabelText('Farm name'), 'Hill Farm');
    await userEvent.type(screen.getByLabelText('Main postcode'), 'ZZ1 1ZZ');
    await userEvent.click(screen.getByRole('button', { name: 'Add farm' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Postcode ZZ1 1ZZ was not found');
  });

  it("shows a shared farm's role in words", async () => {
    renderWith([
      {
        request: { query: FARMS_QUERY },
        result: { data: { farms: [farm('a', 'Hill Farm', 'VIEWER')] } },
      },
    ]);
    expect(await screen.findByText('Viewer')).toBeInTheDocument();
  });

  it('shows invitations and accepts one (FR-8.2)', async () => {
    const accepted = vi.fn(() => ({
      data: { acceptInvite: { __typename: 'Farm', id: 'b', name: 'Low Farm' } },
    }));
    const invites = {
      request: { query: MY_INVITES_QUERY },
      result: {
        data: {
          myInvites: [
            {
              __typename: 'MyInvite',
              id: 'i1',
              farmName: 'Low Farm',
              role: 'WORKER',
              invitedBy: 'ann@example.com',
            },
          ],
        },
      },
    };
    renderWith([
      { request: { query: FARMS_QUERY }, result: { data: { farms: [] } } },
      invites,
      { request: { query: ACCEPT_INVITE, variables: { id: 'i1' } }, result: accepted },
      { request: { query: FARMS_QUERY }, result: { data: { farms: [] } } },
      { request: { query: MY_INVITES_QUERY }, result: { data: { myInvites: [] } } },
    ]);
    expect(
      await screen.findByText(/ann@example.com invited you to Low Farm as a worker/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Accept invitation to Low Farm' }));
    await vi.waitFor(() => expect(accepted).toHaveBeenCalled());
  });

  it('builds a demo farm near a chosen postcode and opens it (v3)', async () => {
    render(
      <MockedProvider
        mocks={[
          { request: { query: FARMS_QUERY }, result: { data: { farms: [] } } },
          {
            request: { query: CREATE_DEMO_FARM, variables: { postcode: 'CA12 5DJ' } },
            result: {
              data: {
                createDemoFarm: { __typename: 'Farm', id: 'demo1', name: 'Fellside Farm (demo)' },
              },
            },
          },
          {
            request: { query: FARMS_QUERY },
            result: { data: { farms: [farm('demo1', 'Fellside Farm (demo)')] } },
          },
        ]}
      >
        <MemoryRouter initialEntries={['/farms']} future={routerFuture}>
          <Routes>
            <Route path="/farms" element={<FarmsPage />} />
            <Route path="/farms/:id" element={<p>Demo dashboard</p>} />
          </Routes>
        </MemoryRouter>
      </MockedProvider>,
    );
    const postcode = await screen.findByLabelText('Postcode for the demo');
    await userEvent.clear(postcode);
    await userEvent.type(postcode, 'CA12 5DJ');
    await userEvent.click(screen.getByRole('button', { name: 'Create the demo farm' }));
    expect(await screen.findByText('Demo dashboard')).toBeInTheDocument();
  });
});
