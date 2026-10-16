import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { todayIso } from '../src/dates';
import {
  BRIEFING_PREFERENCES,
  BRIEFING_QUERY,
  CREATE_TASK,
  REFRESH_BRIEFING,
  SET_TASK_DONE,
} from '../src/graphql/briefing';
import { BriefingPage } from '../src/pages/BriefingPage';
import { routerFuture } from '../src/routerFuture';

const briefing = (overrides: Record<string, unknown> = {}) => ({
  __typename: 'Briefing',
  date: '2026-06-10',
  generatedAt: '2026-06-10T05:00:00.000Z',
  isStale: false,
  flaggedCount: 2,
  farm: { __typename: 'Farm', id: 'farm1', name: 'Hill Farm' },
  overdueTasks: [
    {
      __typename: 'Task',
      id: 'task1',
      title: 'Check water troughs',
      dueDate: '2026-06-08',
      group: { __typename: 'LivestockGroup', id: 'g2', name: 'Beef' },
    },
  ],
  groups: [
    {
      __typename: 'BriefingGroup',
      groupId: 'g1',
      groupName: 'North flock',
      fieldName: 'Top field',
      items: [
        {
          __typename: 'BriefingItem',
          riskId: 'sheep-blowfly',
          riskName: 'Sheep blowfly strike',
          level: 'HIGH',
          daysAffected: [
            { __typename: 'AffectedDay', date: '2026-06-10', level: 'HIGH' },
            { __typename: 'AffectedDay', date: '2026-06-11', level: 'MEDIUM' },
          ],
          reason: 'Warm and humid: blowfly strike risk high',
          checks: ['Check the flock daily for signs of strike'],
          isNew: true,
        },
        {
          __typename: 'BriefingItem',
          riskId: 'liver-fluke',
          riskName: 'Liver fluke season',
          level: 'MEDIUM',
          daysAffected: [{ __typename: 'AffectedDay', date: '2026-06-10', level: 'MEDIUM' }],
          reason: 'Fluke season index 320',
          checks: ['Discuss fluke testing with your vet or adviser'],
          isNew: false,
        },
      ],
    },
  ],
  quietGroups: [{ __typename: 'QuietGroup', groupId: 'g2', groupName: 'Beef' }],
  ...overrides,
});

const prefsMock: MockedResponse = {
  request: { query: BRIEFING_PREFERENCES, variables: { farmId: 'farm1' } },
  result: {
    data: {
      briefingPreferences: {
        __typename: 'BriefingPreferences',
        emailEnabled: true,
        sendAt: '06:00',
        alwaysSend: false,
      },
    },
  },
};

const briefingMock = (data: unknown): MockedResponse => ({
  request: { query: BRIEFING_QUERY, variables: { farmId: 'farm1' } },
  result: { data: { briefing: data } },
});

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={[...mocks, prefsMock]}>
      <MemoryRouter initialEntries={['/farms/farm1/briefing']} future={routerFuture}>
        <Routes>
          <Route path="/farms/:id/briefing" element={<BriefingPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('BriefingPage (FR-4.1, FR-4.2)', () => {
  it('shows each flagged risk with its group, field, level in words, days, reason and checks', async () => {
    renderWith([briefingMock(briefing())]);
    expect(screen.getByText('Loading briefing…')).toBeInTheDocument();

    const flock = await screen.findByRole('region', { name: 'North flock · Top field' });
    const blowfly = within(flock).getByRole('article', { name: /Sheep blowfly strike/ });
    expect(within(blowfly).getByText('High')).toBeInTheDocument();
    expect(within(blowfly).getByText('New')).toBeInTheDocument();
    expect(blowfly).toHaveTextContent('Wed 10 Jun: High · Thu 11 Jun: Medium');
    expect(blowfly).toHaveTextContent('Warm and humid: blowfly strike risk high');
    expect(
      within(blowfly).getByText('Check the flock daily for signs of strike'),
    ).toBeInTheDocument();

    const fluke = within(flock).getByRole('article', { name: /Liver fluke season/ });
    expect(within(fluke).getByText('Medium')).toBeInTheDocument();
    expect(within(fluke).queryByText('New')).not.toBeInTheDocument();
  });

  it('puts overdue tasks at the top (FR-5.5)', async () => {
    renderWith([briefingMock(briefing())]);
    const overdue = await screen.findByRole('region', { name: 'Overdue tasks' });
    expect(overdue).toHaveTextContent('Check water troughs');
    expect(overdue).toHaveTextContent('Beef · was due Mon 8 Jun');
    const flock = screen.getByRole('region', { name: 'North flock · Top field' });
    // Overdue tasks come before the risks in the page
    expect(overdue.compareDocumentPosition(flock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('collapses quiet groups into "No concerns this week"', async () => {
    renderWith([briefingMock(briefing())]);
    const quiet = await screen.findByText('No concerns this week (1)');
    expect(quiet.closest('details')).toHaveTextContent('Beef');
  });

  it('shows the disclaimer', async () => {
    renderWith([briefingMock(briefing())]);
    expect(await screen.findByRole('note')).toHaveTextContent(/not veterinary advice/);
  });

  it('says when it is showing an older briefing because the weather was unavailable', async () => {
    renderWith([briefingMock(briefing({ isStale: true }))]);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Showing the briefing from Wed 10 Jun.*couldn’t fetch today’s weather/,
    );
  });

  it('says when there is nothing to flag at all', async () => {
    renderWith([briefingMock(briefing({ groups: [], overdueTasks: [], flaggedCount: 0 }))]);
    expect(await screen.findByText(/Nothing to flag this week/)).toBeInTheDocument();
  });

  it('shows errors', async () => {
    renderWith([
      {
        request: { query: BRIEFING_QUERY, variables: { farmId: 'farm1' } },
        error: new Error('The briefing is unavailable right now'),
      },
    ]);
    expect(await screen.findByRole('alert')).toHaveTextContent('The briefing is unavailable');
  });

  it('says when the farm isn’t found', async () => {
    renderWith([briefingMock(null)]);
    expect(await screen.findByText('Farm not found')).toBeInTheDocument();
  });
});

describe('BriefingPage actions', () => {
  it('turns a suggested check into a task with one tap (FR-5.2)', async () => {
    const dueDate = ['2026-06-10', todayIso()].sort().at(-1)!;
    const created = vi.fn(() => ({ data: { createTask: { __typename: 'Task', id: 't9' } } }));
    renderWith([
      briefingMock(briefing()),
      {
        request: {
          query: CREATE_TASK,
          variables: {
            input: { groupId: 'g1', title: 'Check the flock daily for signs of strike', dueDate },
          },
        },
        result: created,
      },
      briefingMock(briefing()),
    ]);

    const button = await screen.findByRole('button', {
      name: 'Add task: Check the flock daily for signs of strike',
    });
    await userEvent.click(button);
    await vi.waitFor(() => expect(created).toHaveBeenCalled());
    expect(
      await screen.findByRole('button', {
        name: 'Task added: Check the flock daily for signs of strike',
      }),
    ).toBeDisabled();
  });

  it('marks an overdue task done', async () => {
    const done = vi.fn(() => ({
      data: { setTaskDone: { __typename: 'Task', id: 'task1', done: true } },
    }));
    renderWith([
      briefingMock(briefing()),
      { request: { query: SET_TASK_DONE, variables: { id: 'task1', done: true } }, result: done },
      briefingMock(briefing({ overdueTasks: [] })),
    ]);
    await userEvent.click(await screen.findByRole('button', { name: 'Done: Check water troughs' }));
    await vi.waitFor(() => expect(done).toHaveBeenCalled());
  });

  it('refreshes on request', async () => {
    const refreshed = vi.fn(() => ({
      data: { refreshBriefing: briefing({ generatedAt: '2026-06-10T09:30:00.000Z' }) },
    }));
    renderWith([
      briefingMock(briefing()),
      { request: { query: REFRESH_BRIEFING, variables: { farmId: 'farm1' } }, result: refreshed },
    ]);
    await userEvent.click(await screen.findByRole('button', { name: 'Refresh' }));
    await vi.waitFor(() => expect(refreshed).toHaveBeenCalled());
  });
});
