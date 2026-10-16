import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CREATE_FARM, FARMS_QUERY } from '../src/graphql/farms';
import { FarmsPage } from '../src/pages/FarmsPage';
import { routerFuture } from '../src/routerFuture';

const farm = (id: string, name: string) => ({
  __typename: 'Farm',
  id,
  name,
  postcode: 'UB8 3PH',
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
});
