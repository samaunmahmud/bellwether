import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DELETE_TASK, SET_TASK_DONE, TASKS_PAGE_QUERY } from '../src/graphql/briefing';
import { TasksPage } from '../src/pages/TasksPage';
import { routerFuture } from '../src/routerFuture';

const task = (id: string, extra: Record<string, unknown>) => ({
  __typename: 'Task',
  id,
  title: 'Task',
  dueDate: '2999-01-01',
  note: null,
  done: false,
  overdue: false,
  repeatEveryDays: null,
  group: null,
  ...extra,
});

const tasks = [
  task('t1', { title: 'Check troughs', dueDate: '2000-01-01', overdue: true, repeatEveryDays: 7 }),
  task('t2', {
    title: 'Trim feet',
    group: { __typename: 'LivestockGroup', id: 'g1', name: 'Ewes' },
  }),
  task('t3', { title: 'Order feed', done: true }),
];

const pageMock: MockedResponse = {
  request: { query: TASKS_PAGE_QUERY, variables: { farmId: 'f1' } },
  result: {
    data: {
      farm: {
        __typename: 'Farm',
        id: 'f1',
        name: 'Hill Farm',
        groups: [{ __typename: 'LivestockGroup', id: 'g1', name: 'Ewes' }],
      },
      tasks,
    },
  },
};

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/farms/f1/tasks']} future={routerFuture}>
        <Routes>
          <Route path="/farms/:id/tasks" element={<TasksPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('TasksPage (FR-5.3)', () => {
  it('splits tasks into overdue, to do and done, labelled in words', async () => {
    renderWith([pageMock]);
    const overdue = await screen.findByRole('list', { name: 'Overdue' });
    expect(within(overdue).getByText('Check troughs')).toBeInTheDocument();
    expect(within(overdue).getByText(/Whole farm/)).toBeInTheDocument();
    expect(within(overdue).getByText(/Repeats every 7 days/)).toBeInTheDocument();
    const todo = screen.getByRole('list', { name: 'To do' });
    expect(within(todo).getByText(/Ewes/)).toBeInTheDocument();
    expect(screen.getByText('Done (1)')).toBeInTheDocument();
  });

  it('ticks a task off', async () => {
    const done = vi.fn(() => ({
      data: { setTaskDone: { __typename: 'Task', id: 't2', done: true } },
    }));
    renderWith([
      pageMock,
      { request: { query: SET_TASK_DONE, variables: { id: 't2', done: true } }, result: done },
      pageMock,
    ]);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Done: Trim feet' }));
    await vi.waitFor(() => expect(done).toHaveBeenCalled());
  });

  it('deletes a task after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deleted = vi.fn(() => ({ data: { deleteTask: true } }));
    renderWith([
      pageMock,
      { request: { query: DELETE_TASK, variables: { id: 't2' } }, result: deleted },
      pageMock,
    ]);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Trim feet' }));
    await vi.waitFor(() => expect(deleted).toHaveBeenCalled());
  });

  it('opens an edit form for a task', async () => {
    renderWith([pageMock]);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Trim feet' }));
    expect(screen.getByRole('form', { name: 'Edit task' })).toBeInTheDocument();
  });
});
