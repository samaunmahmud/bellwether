import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CREATE_FIELD, FARM_QUERY } from '../src/graphql/farms';
import { FarmPage } from '../src/pages/FarmPage';
import { routerFuture } from '../src/routerFuture';

const field = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  __typename: 'Field',
  id,
  name,
  postcode: null,
  latitude: null,
  longitude: null,
  ...extra,
});

const farm = {
  __typename: 'Farm',
  id: 'farm1',
  name: 'Hill Farm',
  postcode: 'UB8 3PH',
  fields: [
    field('f1', 'Fell', { latitude: 54.1234, longitude: -2.5432 }),
    field('f2', 'Meadow', { postcode: 'SW1A 1AA' }),
    field('f3', 'Paddock'),
  ],
  groups: [
    {
      __typename: 'LivestockGroup',
      id: 'g1',
      name: 'North flock',
      species: 'SHEEP',
      livestockClass: 'EWES',
      headCount: 120,
      housed: false,
      currentField: { __typename: 'Field', id: 'f1', name: 'Fell' },
      lastShearingDate: '2026-05-20',
      lambingStart: '2026-03-01',
      lambingEnd: '2026-04-15',
      lambsAtGrassThisSpring: true,
      withdrawal: {
        __typename: 'WithdrawalStatus',
        inWithdrawal: true,
        meatEnds: '2026-06-29',
        milkEnds: null,
      },
      cattleType: null,
      calvingStart: null,
      calvingEnd: null,
      movements: [
        {
          __typename: 'GroupMovement',
          id: 'm2',
          movedOn: '2026-05-25',
          fromField: { __typename: 'Field', id: 'f2', name: 'Meadow' },
          toField: { __typename: 'Field', id: 'f1', name: 'Fell' },
        },
        {
          __typename: 'GroupMovement',
          id: 'm1',
          movedOn: '2026-04-01',
          fromField: null,
          toField: { __typename: 'Field', id: 'f2', name: 'Meadow' },
        },
      ],
    },
    {
      __typename: 'LivestockGroup',
      id: 'g2',
      name: 'Dairy herd',
      species: 'CATTLE',
      livestockClass: 'DAIRY_COWS',
      headCount: 80,
      housed: true,
      currentField: null,
      lastShearingDate: null,
      lambingStart: null,
      lambingEnd: null,
      lambsAtGrassThisSpring: false,
      withdrawal: {
        __typename: 'WithdrawalStatus',
        inWithdrawal: false,
        meatEnds: null,
        milkEnds: null,
      },
      cattleType: 'DAIRY',
      calvingStart: null,
      calvingEnd: null,
      movements: [],
    },
  ],
};

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/farms/farm1']} future={routerFuture}>
        <Routes>
          <Route path="/farms/:id" element={<FarmPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

const farmMock = (data: unknown): MockedResponse => ({
  request: { query: FARM_QUERY, variables: { id: 'farm1' } },
  result: { data: { farm: data } },
});

describe('FarmPage', () => {
  it('shows each field with where its weather comes from (FR-2.2)', async () => {
    renderWith([farmMock(farm)]);
    const fields = await screen.findByRole('list', { name: 'Fields' });
    expect(within(fields).getByText('Map pin 54.1234, -2.5432')).toBeInTheDocument();
    expect(within(fields).getByText('SW1A 1AA')).toBeInTheDocument();
    expect(within(fields).getByText('Uses farm postcode')).toBeInTheDocument();
  });

  it('shows each group with its class, head count and where it is (FR-2.3)', async () => {
    renderWith([farmMock(farm)]);
    const flock = await screen.findByRole('article', { name: 'North flock' });
    expect(within(flock).getByText('120 ewes · in Fell')).toBeInTheDocument();
    expect(within(flock).getByText(/Lambing 1 Mar – 15 Apr/)).toBeInTheDocument();

    const herd = screen.getByRole('article', { name: 'Dairy herd' });
    expect(within(herd).getByText('80 dairy cows · housed')).toBeInTheDocument();
  });

  it('flags groups in withdrawal in words and links to their records (FR-6.2)', async () => {
    renderWith([farmMock(farm)]);
    const flock = await screen.findByRole('article', { name: 'North flock' });
    expect(within(flock).getByText('In withdrawal until Mon 29 Jun')).toBeInTheDocument();
    expect(within(flock).getByRole('link', { name: 'Records for North flock' })).toHaveAttribute(
      'href',
      '/groups/g1',
    );
    const herd = screen.getByRole('article', { name: 'Dairy herd' });
    expect(within(herd).queryByText(/In withdrawal/)).not.toBeInTheDocument();
  });

  it('links to the morning briefing', async () => {
    renderWith([farmMock(farm)]);
    expect(await screen.findByRole('link', { name: 'Morning briefing' })).toHaveAttribute(
      'href',
      '/farms/farm1/briefing',
    );
  });

  it('links to the farm’s treatment records for audits (FR-6.4)', async () => {
    renderWith([farmMock(farm)]);
    expect(await screen.findByRole('link', { name: 'Treatment records' })).toHaveAttribute(
      'href',
      '/farms/farm1/records',
    );
  });

  it('shows a group’s move history, newest first (FR-2.4)', async () => {
    renderWith([farmMock(farm)]);
    const flock = await screen.findByRole('article', { name: 'North flock' });
    const history = within(flock).getByRole('list', { name: 'Move history' });
    expect(
      within(history)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([expect.stringContaining('Meadow → Fell'), expect.stringContaining('Into Meadow')]);
  });

  it('adds a field to this farm and refreshes', async () => {
    renderWith([
      farmMock({ ...farm, fields: [], groups: [] }),
      {
        request: {
          query: CREATE_FIELD,
          variables: {
            input: {
              farmId: 'farm1',
              name: 'Top',
              postcode: null,
              latitude: null,
              longitude: null,
            },
          },
        },
        result: { data: { createField: { __typename: 'Field', id: 'f9' } } },
      },
      farmMock({ ...farm, fields: [field('f9', 'Top')], groups: [] }),
    ]);

    await userEvent.type(await screen.findByLabelText('Field name'), 'Top');
    await userEvent.click(screen.getByRole('button', { name: 'Add field' }));

    const fields = await screen.findByRole('list', { name: 'Fields' });
    expect(within(fields).getByText('Top')).toBeInTheDocument();
  });

  it('says when the farm doesn’t exist or isn’t yours (A14)', async () => {
    renderWith([farmMock(null)]);
    expect(await screen.findByText('Farm not found')).toBeInTheDocument();
  });
});
