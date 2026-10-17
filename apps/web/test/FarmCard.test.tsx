import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FarmCard } from '../src/components/FarmCard';
import { FARM_CARD_QUERY } from '../src/graphql/v3';
import { routerFuture } from '../src/routerFuture';

const summary = { id: 'f1', name: 'Fellside Farm', postcode: 'LA9 4DQ', myRole: 'WORKER' as const };

const snapshot: MockedResponse = {
  request: { query: FARM_CARD_QUERY, variables: { id: 'f1' } },
  result: {
    data: {
      farm: {
        __typename: 'Farm',
        id: 'f1',
        stats: {
          __typename: 'FarmStats',
          totalHead: 626,
          sheep: 563,
          cattle: 63,
          overdueTasks: 2,
          groupsInWithdrawal: 1,
        },
        weather: [
          {
            __typename: 'WeatherDay',
            date: '2026-10-17',
            tempMaxC: 12.4,
            tempMinC: 3.2,
            precipitationMm: 0,
          },
        ],
      },
    },
  },
};

function renderCard(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter future={routerFuture}>
        <ul>
          <FarmCard farm={summary} />
        </ul>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('FarmCard (v3.2)', () => {
  it('shows the farm’s figures and today’s weather once they load', async () => {
    renderCard([snapshot]);
    const figures = await screen.findByRole('list', { name: 'Fellside Farm at a glance' });
    expect(within(figures).getByText('626')).toBeInTheDocument();
    expect(within(figures).getByText(/animals/)).toBeInTheDocument();
    expect(within(figures).getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/12° \/ 3°/)).toBeInTheDocument();
    expect(screen.getByText('Worker')).toBeInTheDocument();
  });

  it('still links to the farm when its figures can’t load', async () => {
    renderCard([{ request: snapshot.request, error: new Error('Network down') }]);
    expect(screen.getByRole('link', { name: /^Fellside Farm/ })).toHaveAttribute(
      'href',
      '/farms/f1',
    );
    expect(screen.getByRole('link', { name: 'Briefing for Fellside Farm' })).toBeInTheDocument();
  });
});
