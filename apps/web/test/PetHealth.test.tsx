import { MockedProvider } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import { daysUntil, dueText, PetHealth } from '../src/components/PetHealth';
import { PET_HEALTH_QUERY } from '../src/graphql/v3';

const log = (
  id: string,
  date: string,
  type: string,
  nextDueDate: string | null,
  weightKg: number | null = null,
) => ({
  __typename: 'LogEntry',
  id,
  date,
  type,
  nextDueDate,
  weightKg,
});

describe('PetHealth (v3)', () => {
  it('counts days to a due date', () => {
    expect(daysUntil('2026-06-11', '2026-06-01')).toBe(10);
    expect(dueText(0)).toBe('Due today');
    expect(dueText(1)).toBe('Due in 1 day');
    expect(dueText(-3)).toBe('Overdue by 3 days');
  });

  it('shows the latest due date of each kind, the weight chart and the walk planner', async () => {
    render(
      <MockedProvider
        mocks={[
          {
            request: { query: PET_HEALTH_QUERY, variables: { id: 'p1' } },
            result: {
              data: {
                animal: {
                  __typename: 'Animal',
                  id: 'p1',
                  name: 'Rex',
                  species: 'dog',
                  // Newest first
                  logs: [
                    log('l3', '2026-05-20', 'Weighed', null, 21.5),
                    log('l2', '2026-05-01', 'Vaccination', '2000-01-01'),
                    log('l1', '2026-01-01', 'Vaccination', '2026-02-01', 20),
                  ],
                  walkPlanner: {
                    __typename: 'WalkPlan',
                    date: '2026-06-01',
                    bestTimes: ['06:00–09:00'],
                    hours: [
                      {
                        __typename: 'WalkHour',
                        time: '2026-06-01T07:00',
                        tempC: 15,
                        level: 'GOOD',
                      },
                      { __typename: 'WalkHour', time: '2026-06-01T14:00', tempC: 27, level: 'HOT' },
                    ],
                  },
                },
              },
            },
          },
        ]}
      >
        <PetHealth petId="p1" />
      </MockedProvider>,
    );
    const plan = await screen.findByRole('region', { name: 'Health plan' });
    expect(within(plan).getAllByRole('listitem')).toHaveLength(1);
    expect(within(plan).getByText(/Overdue by/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Rex's weight/ })).toBeInTheDocument();
    const walk = screen.getByRole('region', { name: /Walk planner/ });
    expect(walk).toHaveTextContent('Best times for a walk: 06:00–09:00');
    expect(within(walk).getByText('Hot')).toBeInTheDocument();
  });
});
