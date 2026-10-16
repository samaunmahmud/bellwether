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
import type { FarmTask } from '../types';

interface PageData {
  farm: { id: string; name: string; groups: Array<{ id: string; name: string }> } | null;
  tasks: FarmTask[];
}

const repeatLabel = (days: number | null) =>
  days === null ? null : days === 1 ? 'Repeats every day' : `Repeats every ${days} days`;

/** FR-5.3: all of a farm's tasks, for groups or the whole farm, with repeats. */
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

  if (loading) return <p aria-live="polite">Loading tasks…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  if (!data?.farm) return <h1>Farm not found</h1>;
  const { farm, tasks } = data;

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
            initial={{ ...task, groupId: task.group?.id ?? null }}
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
    ].filter(Boolean);
    return (
      <li key={task.id} className={task.done ? 'task task--done' : 'task'}>
        <label className="toggle task__check">
          <input
            type="checkbox"
            checked={task.done}
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
      </li>
    );
  }

  return (
    <section>
      <p className="muted">
        <Link to={`/farms/${farm.id}`}>{farm.name}</Link>
      </p>
      <h1>Tasks</h1>

      <TaskForm
        groups={farm.groups}
        onSubmit={(values) => createTask({ variables: { input: { farmId: farm.id, ...values } } })}
      />

      {tasks.length === 0 && (
        <p className="muted">
          No tasks yet. Add one above, or from a suggested check on the{' '}
          <Link to={`/farms/${farm.id}/briefing`}>morning briefing</Link>.
        </p>
      )}

      {overdue.length > 0 && (
        <section className="overdue">
          <h2>Overdue</h2>
          <ul className="tasks" aria-label="Overdue">
            {overdue.map(row)}
          </ul>
        </section>
      )}

      {todo.length > 0 && (
        <>
          <h2>To do</h2>
          <ul className="tasks" aria-label="To do">
            {todo.map(row)}
          </ul>
        </>
      )}

      {done.length > 0 && (
        <details className="quiet">
          <summary>Done ({done.length})</summary>
          <ul className="tasks" aria-label="Done">
            {done.map(row)}
          </ul>
        </details>
      )}
    </section>
  );
}
