import { useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TaskForm, type TaskFormValues } from '../components/TaskForm';
import { shortDay } from '../dates';
import {
  CREATE_TASK,
  DELETE_TASK,
  SET_TASK_DONE,
  TASKS_PAGE_QUERY,
  UPDATE_TASK,
} from '../graphql/briefing';
import { canWork } from '../roles';
import type { FarmMember, FarmRole, FarmTask } from '../types';

interface PageData {
  farm: {
    id: string;
    name: string;
    myRole: FarmRole;
    groups: Array<{ id: string; name: string }>;
    members: FarmMember[];
  } | null;
  tasks: FarmTask[];
}

const repeatLabel = (days: number | null) =>
  days === null ? null : days === 1 ? 'Repeats every day' : `Repeats every ${days} days`;

const assigneeLabel = (task: FarmTask) =>
  task.assignedToMe ? 'Assigned to you' : task.assignee && `Assigned to ${task.assignee.email}`;

/**
 * FR-5.3: all of a farm's tasks, for groups or the whole farm, with repeats.
 * Tasks can be assigned to workers and owners (FR-5.4); viewers only look (FR-8.2).
 */
export function TasksPage() {
  const { id = '' } = useParams();
  const { data, loading, error } = useQuery<PageData>(TASKS_PAGE_QUERY, {
    variables: { farmId: id },
  });
  const refetch = { refetchQueries: [{ query: TASKS_PAGE_QUERY, variables: { farmId: id } }] };
  const [createTask] = useMutation(CREATE_TASK, refetch);
  const [updateTask] = useMutation(UPDATE_TASK, refetch);
  const [deleteTask] = useMutation(DELETE_TASK, refetch);
  const [setDone] = useMutation(SET_TASK_DONE, refetch);
  const [editing, setEditing] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [dragOver, setDragOver] = useState<'todo' | 'done' | null>(null);

  if (loading) return <p aria-live="polite">Loading tasks…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  if (!data?.farm) return <h1>Farm not found</h1>;
  const { farm } = data;
  const tasks = onlyMine ? data.tasks.filter((t) => t.assignedToMe) : data.tasks;
  const worker = canWork(farm.myRole);
  // Viewers can't be given tasks: the API refuses them.
  const people = farm.members
    .filter((m) => canWork(m.role))
    .map((m) => ({ id: m.userId, label: m.isMe ? `You (${m.email})` : m.email }));

  const overdue = tasks.filter((t) => t.overdue);
  const todo = tasks.filter((t) => !t.done && !t.overdue);
  // Most recently due first
  const done = tasks.filter((t) => t.done).reverse();

  function row(task: FarmTask) {
    if (editing === task.id)
      return (
        <li key={task.id} className="task">
          <TaskForm
            groups={farm.groups}
            people={people}
            initial={{
              ...task,
              groupId: task.group?.id ?? null,
              assigneeId: task.assignee?.id ?? null,
            }}
            onCancel={() => setEditing(null)}
            onSubmit={async (values: TaskFormValues) => {
              await updateTask({ variables: { id: task.id, input: values } });
              setEditing(null);
            }}
          />
        </li>
      );
    const details = [
      task.group?.name ?? 'Whole farm',
      `${task.done || task.overdue ? 'was due' : 'due'} ${shortDay(task.dueDate)}`,
      repeatLabel(task.repeatEveryDays),
      assigneeLabel(task),
    ].filter(Boolean);
    return (
      <li key={task.id} className={task.done ? 'task task--done' : 'task'}>
        <label className="toggle task__check">
          <input
            type="checkbox"
            checked={task.done}
            disabled={!worker}
            aria-label={`Done: ${task.title}`}
            onChange={(e) => setDone({ variables: { id: task.id, done: e.target.checked } })}
          />
          <span>
            <strong className="task__title">{task.title}</strong>
            {task.overdue && <span className="pill pill--overdue">Overdue</span>}
            <br />
            <span className="muted">{details.join(' · ')}</span>
            {task.note && (
              <>
                <br />
                <span>{task.note}</span>
              </>
            )}
          </span>
        </label>
        {worker && (
          <span className="log__actions">
            <button
              type="button"
              className="link-button"
              aria-label={`Edit ${task.title}`}
              onClick={() => setEditing(task.id)}
            >
              Edit
            </button>
            <button
              type="button"
              className="link-button"
              aria-label={`Delete ${task.title}`}
              onClick={() => {
                if (window.confirm(`Delete the task "${task.title}"?`))
                  void deleteTask({ variables: { id: task.id } });
              }}
            >
              Delete
            </button>
          </span>
        )}
      </li>
    );
  }

  return (
    <section>
      <p className="muted">
        <Link to={`/farms/${farm.id}`}>{farm.name}</Link>
      </p>
      <h1>Tasks</h1>
      <TaskSummary overdue={overdue.length} todo={todo.length} done={done.length} />

      <div className="tasks-layout">
        <div className="tasks-layout__main">
          <label className="toggle">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
            />
            Only my tasks
          </label>

          <div className="tabs" role="tablist" aria-label="View">
            {(['list', 'board'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className={view === v ? 'tab is-active' : 'tab'}
                onClick={() => setView(v)}
              >
                {v === 'list' ? 'List' : 'Board'}
              </button>
            ))}
          </div>

          {onlyMine && tasks.length === 0 && <p className="muted">No tasks are assigned to you.</p>}

          {view === 'board' && tasks.length > 0 && (
            <div className="board">
              {(
                [
                  ['overdue', 'Overdue', overdue],
                  ['todo', 'To do', todo],
                  ['done', 'Done', done],
                ] as const
              ).map(([key, title, list]) => {
                const target = key === 'done' ? 'done' : 'todo';
                return (
                  <section
                    key={key}
                    className={`board__column board__column--${key}${dragOver === target && key !== 'overdue' ? ' is-over' : ''}`}
                    aria-label={title}
                    onDragOver={(e) => {
                      if (!worker || key === 'overdue') return;
                      e.preventDefault();
                      setDragOver(target);
                    }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(null);
                      const taskId = e.dataTransfer.getData('text/plain');
                      const task = tasks.find((t) => t.id === taskId);
                      if (task && key !== 'overdue' && task.done !== (key === 'done'))
                        void setDone({ variables: { id: task.id, done: key === 'done' } });
                    }}
                  >
                    <h2>
                      {title} <span className="muted">{list.length}</span>
                    </h2>
                    {list.length === 0 && <p className="board__empty muted">Nothing here.</p>}
                    {list.map((task) => (
                      <article
                        key={task.id}
                        className={`board__card${task.overdue ? ' board__card--overdue' : ''}`}
                        draggable={worker}
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                      >
                        <strong>{task.title}</strong>
                        <span className="muted">
                          {task.group?.name ?? 'Whole farm'} · {shortDay(task.dueDate)}
                        </span>
                        {assigneeLabel(task) && (
                          <span className="muted">{assigneeLabel(task)}</span>
                        )}
                        {worker && (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              setDone({ variables: { id: task.id, done: !task.done } })
                            }
                          >
                            {task.done ? 'Not done' : 'Mark done'}
                          </button>
                        )}
                      </article>
                    ))}
                  </section>
                );
              })}
            </div>
          )}

          {!onlyMine && tasks.length === 0 && (
            <p className="muted">
              No tasks yet. Add one with the form, or from a suggested check on the{' '}
              <Link to={`/farms/${farm.id}/briefing`}>morning briefing</Link>.
            </p>
          )}

          {view === 'list' && overdue.length > 0 && (
            <section className="overdue">
              <h2>Overdue</h2>
              <ul className="tasks" aria-label="Overdue">
                {overdue.map(row)}
              </ul>
            </section>
          )}

          {view === 'list' && todo.length > 0 && (
            <>
              <h2>To do</h2>
              <ul className="tasks" aria-label="To do">
                {todo.map(row)}
              </ul>
            </>
          )}

          {view === 'list' && done.length > 0 && (
            <details className="quiet">
              <summary>Done ({done.length})</summary>
              <ul className="tasks" aria-label="Done">
                {done.map(row)}
              </ul>
            </details>
          )}
        </div>
        <aside className="tasks-layout__side panel" aria-label="Add a task">
          <h2>Add a task</h2>
          {worker ? (
            <TaskForm
              groups={farm.groups}
              people={people}
              onSubmit={(values) =>
                createTask({ variables: { input: { farmId: farm.id, ...values } } })
              }
            />
          ) : (
            <p className="muted">You can view this farm's tasks but not change them.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

/** v3.2: how the farm's jobs stand, with a ring for the share done. */
function TaskSummary({ overdue, todo, done }: { overdue: number; todo: number; done: number }) {
  const total = overdue + todo + done;
  const share = total ? done / total : 0;
  const r = 22;
  const length = 2 * Math.PI * r;
  return (
    <div className="task-summary">
      <div className="task-summary__ring">
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
          <circle cx="28" cy="28" r={r} className="task-summary__track" />
          <circle
            cx="28"
            cy="28"
            r={r}
            className="task-summary__done"
            strokeDasharray={`${share * length} ${length}`}
            transform="rotate(-90 28 28)"
          />
        </svg>
        <span>
          <strong>
            {done} of {total}
          </strong>{' '}
          done
        </span>
      </div>
      <span className={overdue ? 'task-summary__count is-alert' : 'task-summary__count'}>
        <strong>{overdue}</strong> overdue
      </span>
      <span className="task-summary__count">
        <strong>{todo}</strong> to do
      </span>
    </div>
  );
}
