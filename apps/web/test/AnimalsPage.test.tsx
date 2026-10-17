import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ANIMALS_QUERY } from '../src/graphql/queries';
import { AnimalsPage } from '../src/pages/AnimalsPage';
import { routerFuture } from '../src/routerFuture';

const log = (id: string, type: string, nextDueDate: string | null) => ({
  __typename: 'LogEntry',
  id,
  date: '2026-01-01',
  type,
  note: null,
  nextDueDate,
});

const animals: MockedResponse = {
  request: { query: ANIMALS_QUERY },
  result: {
    data: {
      animals: [
        {
          __typename: 'Animal',
          id: 'p1',
          name: 'Bess',
          species: 'dog',
          category: 'PET',
          postcode: 'LA9 4DQ',
          highExposureHabitat: true,
          logs: [log('l1', 'Worming', '2000-01-01'), log('l2', 'Vaccination', '2999-01-01')],
        },
      ],
    },
  },
};

describe('AnimalsPage (v3.2)', () => {
  it('shows each pet as a card with what’s overdue and what’s next, in words', async () => {
    render(
      <MockedProvider mocks={[animals]}>
        <MemoryRouter future={routerFuture}>
          <AnimalsPage />
        </MemoryRouter>
      </MockedProvider>,
    );
    const card = await screen.findByRole('link', { name: /Bess/ });
    expect(card).toHaveAttribute('href', '/pets/p1');
    expect(within(card).getByText(/Worming overdue/)).toBeInTheDocument();
    expect(within(card).getByText(/Vaccination due/)).toBeInTheDocument();
    expect(within(card).getByText(/long grass/)).toBeInTheDocument();
  });
});
