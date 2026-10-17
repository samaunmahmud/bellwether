import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DASHBOARD_QUERY } from '../src/graphql/v3';
import { FarmDashboardPage, greeting } from '../src/pages/FarmDashboardPage';
import { routerFuture } from '../src/routerFuture';

const farm = (myRole = 'OWNER') => ({
  __typename: 'Farm',
  id: 'f1',
  name: 'Fellside Farm',
  postcode: 'LA9 4DQ',
  cphNumber: '12/345/6789',
  flockMark: null,
  myRole,
  stats: {
    __typename: 'FarmStats',
    totalHead: 1234,
    sheep: 1200,
    cattle: 34,
    bornAlive: 300,
    bornDead: 10,
    deaths: 8,
    movedOn: 2,
    movedOff: 40,
    mortalityPct: 0.6,
    birthSurvivalPct: 96.8,
    groupsInWithdrawal: 1,
    openTasks: 5,
    overdueTasks: 2,
  },
  alerts: [
    {
      __typename: 'Alert',
      level: 'URGENT',
      title: 'Overdue: Trim feet',
      detail: 'Was due 2026-05-30',
      link: '/farms/f1/tasks',
    },
  ],
  activity: [
    {
      __typename: 'ActivityItem',
      date: '2026-05-28',
      kind: 'DEATH',
      title: '1 died',
      detail: 'Mastitis',
      groupId: 'g1',
      groupName: 'Ewes',
    },
  ],
  weather: Array.from({ length: 7 }, (_, i) => ({
    __typename: 'WeatherDay',
    date: `2026-06-0${i + 1}`,
    tempMaxC: 18 + i,
    tempMinC: 8,
    precipitationMm: i,
  })),
  groups: [],
});

const mock = (data: unknown): MockedResponse => ({
  request: { query: DASHBOARD_QUERY, variables: { id: 'f1' } },
  result: { data: { farm: data } },
});

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/farms/f1']} future={routerFuture}>
        <Routes>
          <Route path="/farms/:id" element={<FarmDashboardPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('FarmDashboardPage (v3)', () => {
  it('leads with the farm’s figures, each linking to its detail', async () => {
    renderWith([mock(farm())]);
    const figures = await screen.findByLabelText('Farm figures');
    expect(
      within(figures).getByRole('link', { name: /Animals on the holding 1,234/ }),
    ).toHaveAttribute('href', '/farms/f1/livestock');
    expect(within(figures).getByRole('link', { name: /Tasks overdue 2/ })).toBeInTheDocument();
    expect(within(figures).getByText('96.8%')).toBeInTheDocument();
  });

  it('lists what needs attention in words and recent activity', async () => {
    renderWith([mock(farm())]);
    const alerts = await screen.findByRole('region', { name: 'Needs attention' });
    expect(within(alerts).getByText('Urgent')).toBeInTheDocument();
    expect(within(alerts).getByRole('link', { name: /Overdue: Trim feet/ })).toHaveAttribute(
      'href',
      '/farms/f1/tasks',
    );
    const activity = screen.getByRole('region', { name: 'Recent activity' });
    expect(within(activity).getByText('1 died')).toBeInTheDocument();
    expect(within(activity).getByRole('link', { name: 'Ewes' })).toHaveAttribute(
      'href',
      '/groups/g1',
    );
  });

  it('offers quick actions to workers but not viewers, and always the disclaimer', async () => {
    renderWith([mock(farm('VIEWER'))]);
    await screen.findByRole('heading', { name: 'Fellside Farm' });
    expect(screen.queryByLabelText('Quick actions')).not.toBeInTheDocument();
    expect(screen.getByText(/not veterinary advice/i)).toBeInTheDocument();
  });

  it('says when the farm isn’t found', async () => {
    renderWith([mock(null)]);
    expect(await screen.findByText('Farm not found')).toBeInTheDocument();
  });

  it('opens with a greeting and today’s weather over the farm photo', async () => {
    renderWith([mock(farm())]);
    const hero = await screen.findByRole('region', { name: 'Fellside Farm' });
    expect(within(hero).getByText(/^Good (morning|afternoon|evening)/)).toBeInTheDocument();
    const today = within(hero).getByRole('group', { name: 'Today’s weather' });
    expect(today).toHaveTextContent('18°');
    expect(today).toHaveTextContent('8°');
    expect(today).toHaveTextContent('0 mm rain');
  });
});

describe('greeting', () => {
  it.each([
    [4, 'Good evening'],
    [5, 'Good morning'],
    [11, 'Good morning'],
    [12, 'Good afternoon'],
    [17, 'Good afternoon'],
    [18, 'Good evening'],
    [23, 'Good evening'],
  ])('%i:00 → %s', (hour, text) => {
    expect(greeting(hour)).toBe(text);
  });
});
