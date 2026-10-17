import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ADD_TAGGED_ANIMAL, TAGGED_ANIMALS_QUERY } from '../src/graphql/keeping';
import { formatAge } from '../src/dates';
import { TaggedAnimalsPage } from '../src/pages/TaggedAnimalsPage';
import { routerFuture } from '../src/routerFuture';

const cow = (overrides: Record<string, unknown> = {}) => ({
  __typename: 'TaggedAnimal',
  id: 'a1',
  tag: 'UK 000000 100001',
  name: 'Clover',
  species: 'CATTLE',
  sex: 'FEMALE',
  breed: 'Jersey',
  dateOfBirth: '2023-04-01',
  ageMonths: 38,
  status: 'ON_FARM',
  statusDate: null,
  notes: null,
  group: { __typename: 'LivestockGroup', id: 'g1', name: 'Milking herd' },
  ...overrides,
});

const page = (animals: unknown[], myRole = 'OWNER'): MockedResponse => ({
  request: { query: TAGGED_ANIMALS_QUERY, variables: { farmId: 'f1' } },
  result: {
    data: {
      farm: {
        __typename: 'Farm',
        id: 'f1',
        name: 'Brookside',
        myRole,
        groups: [
          { __typename: 'LivestockGroup', id: 'g1', name: 'Milking herd', species: 'CATTLE' },
          { __typename: 'LivestockGroup', id: 'g2', name: 'Ewes', species: 'SHEEP' },
        ],
      },
      taggedAnimals: animals,
    },
  },
});

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/farms/f1/animals']} future={routerFuture}>
        <Routes>
          <Route path="/farms/:id/animals" element={<TaggedAnimalsPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('formatAge', () => {
  it.each([
    [null, '–'],
    [0, 'Under a month'],
    [7, '7 months'],
    [12, '1 year'],
    [38, '3 years 2 months'],
  ])('%s months → %s', (months, text) => {
    expect(formatAge(months)).toBe(text);
  });
});

describe('TaggedAnimalsPage (v4)', () => {
  it('lists animals on the farm with tag, age and group, and hides sold ones by default', async () => {
    renderWith([
      page([
        cow(),
        cow({ id: 'a2', tag: 'UK 2', name: 'Gone', status: 'SOLD', statusDate: '2026-05-01' }),
      ]),
    ]);
    const table = await screen.findByRole('table', { name: /animals/i });
    const row = within(table).getByRole('row', { name: /UK 000000 100001/ });
    expect(row).toHaveTextContent('Clover');
    expect(row).toHaveTextContent('3 years 2 months');
    expect(row).toHaveTextContent('Milking herd');
    expect(within(table).queryByText('Gone')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Show'), 'SOLD');
    expect(within(table).getByText('Gone')).toBeInTheDocument();
    expect(within(table).getByText(/Sold 1 May 2026/)).toBeInTheDocument();
  });

  it('finds an animal by tag, ignoring spaces and case', async () => {
    renderWith([page([cow(), cow({ id: 'a2', tag: 'UK 2', name: 'Other' })])]);
    await screen.findByRole('table', { name: /animals/i });
    await userEvent.type(screen.getByLabelText('Find a tag'), 'uk000000');
    expect(screen.getByText('Clover')).toBeInTheDocument();
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });

  it('adds an animal, offering only groups of its species', async () => {
    const added = cow({ id: 'a3', tag: 'UK 9', name: 'Willow' });
    const add: MockedResponse = {
      request: {
        query: ADD_TAGGED_ANIMAL,
        variables: {
          input: {
            farmId: 'f1',
            tag: 'UK 9',
            name: 'Willow',
            species: 'CATTLE',
            sex: 'FEMALE',
            breed: null,
            dateOfBirth: '2024-02-10',
            groupId: 'g1',
            notes: null,
          },
        },
      },
      result: { data: { addTaggedAnimal: added } },
    };
    renderWith([page([]), add, page([added])]);
    await userEvent.click(await screen.findByRole('button', { name: /Add an animal/ }));
    const form = screen.getByRole('form', { name: 'Animal' });
    await userEvent.type(within(form).getByLabelText('Ear tag or ID'), 'UK 9');
    await userEvent.type(within(form).getByLabelText('Name'), 'Willow');
    await userEvent.selectOptions(within(form).getByLabelText('Species'), 'CATTLE');
    const group = within(form).getByLabelText('Group');
    expect(within(group).queryByRole('option', { name: 'Ewes' })).not.toBeInTheDocument();
    await userEvent.selectOptions(group, 'g1');
    await userEvent.type(within(form).getByLabelText('Date of birth'), '2024-02-10');
    await userEvent.click(within(form).getByRole('button', { name: 'Save animal' }));
    expect(await screen.findByText('Willow')).toBeInTheDocument();
  });

  it('hides adding and editing from viewers', async () => {
    renderWith([page([cow()], 'VIEWER')]);
    await screen.findByRole('table', { name: /animals/i });
    expect(screen.queryByRole('button', { name: /Add an animal/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
  });
});
