import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
  assignee: null,
  assignedToMe: false,
  ...extra,
});

const tasks = [
  task('t1', { title: 'Check troughs', dueDate: '2000-01-01', overdue: true, repeatEveryDays: 7 }),
  task('t2', {
    title: 'Trim feet',
    group: { __typename: 'LivestockGroup', id: 'g1', name: 'Ewes' },
    assignee: { __typename: 'User', id: 'u2', email: 'bob@example.com' },
  }),
  task('t4', {
    title: 'Fix gate',
    assignee: { __typename: 'User', id: 'u1', email: 'ann@example.com' },
    assignedToMe: true,
  }),
  task('t3', { title: 'Order feed', done: true }),
];

const member = (userId: string, email: string, role: string, isMe = false) => ({
  __typename: 'FarmMember',
  userId,
  email,
  role,
  isMe,
});

const pageMockAs = (myRole: string): MockedResponse => ({
  request: { query: TASKS_PAGE_QUERY, variables: { farmId: 'f1' } },
  result: {
    data: {
      farm: {
        __typename: 'Farm',
        id: 'f1',
        name: 'Hill Farm',
        myRole,
        groups: [{ __typename: 'LivestockGroup', id: 'g1', name: 'Ewes' }],
        members: [
          member('u1', 'ann@example.com', myRole, true),
          member('u2', 'bob@example.com', 'WORKER'),
          member('u3', 'vic@example.com', 'VIEWER'),
        ],
      },
      tasks,
    },
  },
});
const pageMock = pageMockAs('OWNER');

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

  describe('people (FR-5.4, FR-8.2)', () => {
    it('shows who each task is assigned to', async () => {
      renderWith([pageMock]);
      const todo = await screen.findByRole('list', { name: 'To do' });
      expect(within(todo).getByText(/Assigned to bob@example.com/)).toBeInTheDocument();
      expect(within(todo).getByText(/Assigned to you/)).toBeInTheDocument();
    });

    it('filters to only my tasks', async () => {
      renderWith([pageMock]);
      await userEvent.click(await screen.findByRole('checkbox', { name: 'Only my tasks' }));
      const todo = screen.getByRole('list', { name: 'To do' });
      expect(within(todo).getByText('Fix gate')).toBeInTheDocument();
      expect(within(todo).queryByText('Trim feet')).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Overdue' })).not.toBeInTheDocument();
    });

    it('offers only workers and owners to assign to', async () => {
      renderWith([pageMock]);
      const form = await screen.findByRole('form', { name: 'Add task' });
      const options = within(within(form).getByLabelText('Assign to'))
        .getAllByRole('option')
        .map((o) => o.textContent);
      expect(options).toEqual(['No one', 'You (ann@example.com)', 'bob@example.com']);
    });

    it('shows a viewer the tasks but nothing to change', async () => {
      renderWith([pageMockAs('VIEWER')]);
      expect(await screen.findByRole('list', { name: 'To do' })).toBeInTheDocument();
      expect(screen.queryByRole('form', { name: 'Add task' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Done: Trim feet' })).toBeDisabled();
    });
  });

  describe('board (v3)', () => {
    it('shows columns and marks a task done when it is dropped on Done', async () => {
      const done = vi.fn(() => ({
        data: { setTaskDone: { __typename: 'Task', id: 't2', done: true } },
      }));
      renderWith([
        pageMock,
        { request: { query: SET_TASK_DONE, variables: { id: 't2', done: true } }, result: done },
        pageMock,
      ]);
      await userEvent.click(await screen.findByRole('tab', { name: 'Board' }));
      const todo = screen.getByRole('region', { name: 'To do' });
      const card = within(todo).getByText('Trim feet').closest('article')!;
      const data = new Map<string, string>();
      const dataTransfer = {
        setData: (k: string, v: string) => data.set(k, v),
        getData: (k: string) => data.get(k) ?? '',
      };
      fireEvent.dragStart(card, { dataTransfer });
      const doneColumn = screen.getByRole('region', { name: 'Done' });
      fireEvent.dragOver(doneColumn, { dataTransfer });
      fireEvent.drop(doneColumn, { dataTransfer });
      await vi.waitFor(() => expect(done).toHaveBeenCalled());
    });
  });
});
