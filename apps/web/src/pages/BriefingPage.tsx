import { useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BriefingEmailSettings } from '../components/BriefingEmailSettings';
import { Disclaimer } from '../components/Disclaimer';
import { RiskBadge } from '../components/RiskBadge';
import { shortDay, todayIso } from '../dates';
import { errorMessage } from '../errors';
import { BRIEFING_QUERY, CREATE_TASK, REFRESH_BRIEFING, SET_TASK_DONE } from '../graphql/briefing';
import type { Briefing, BriefingItem } from '../types';

const LEVEL_WORD = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' } as const;

const ukTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });

function Item({
  item,
  added,
  onAddTask,
}: {
  item: BriefingItem;
  added: (check: string) => boolean;
  onAddTask: (check: string) => void;
}) {
  const headingId = `item-${item.riskId}-${item.daysAffected[0]!.date}`;
  return (
    <article className="briefing-item" aria-labelledby={headingId}>
      <header className="briefing-item__header">
        <RiskBadge level={item.level} />
        {item.isNew && <span className="tag-new">New</span>}
        <h4 id={headingId}>{item.riskName}</h4>
      </header>
      <p className="muted">
        {item.daysAffected.map((d) => `${shortDay(d.date)} (${LEVEL_WORD[d.level]})`).join(', ')}
      </p>
      <p>{item.reason}</p>
      <ul className="checks">
        {item.checks.map((check) => (
          <li key={check}>
            <span>{check}</span>
            <button
              type="button"
              className="secondary"
              disabled={added(check)}
              aria-label={`${added(check) ? 'Task added' : 'Add task'}: ${check}`}
              onClick={() => onAddTask(check)}
            >
              {added(check) ? 'Task added' : 'Add task'}
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** FR-4.1, FR-4.2, FR-5.5: the farm morning briefing. */
export function BriefingPage() {
  const { id = '' } = useParams();
  const variables = { farmId: id };
  const { data, loading, error } = useQuery<{ briefing: Briefing | null }>(BRIEFING_QUERY, {
    variables,
  });
  const [refresh, refreshState] = useMutation(REFRESH_BRIEFING, {
    update(cache, result) {
      const fresh = (result.data as { refreshBriefing?: Briefing } | null)?.refreshBriefing;
      if (fresh) cache.writeQuery({ query: BRIEFING_QUERY, variables, data: { briefing: fresh } });
    },
  });
  const [createTask] = useMutation(CREATE_TASK);
  const [setTaskDone] = useMutation(SET_TASK_DONE, {
    refetchQueries: [{ query: BRIEFING_QUERY, variables }],
  });
  const [addedTasks, setAddedTasks] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) return <p aria-live="polite">Loading briefing…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  const briefing = data?.briefing;
  if (!briefing) return <h1>Farm not found</h1>;

  /** FR-5.2: one tap turns a check into a task, due on the first day affected. */
  async function addTask(groupId: string, item: BriefingItem, check: string) {
    const firstDay = item.daysAffected[0]!.date;
    const dueDate = [firstDay, todayIso()].sort().at(-1)!;
    try {
      await createTask({ variables: { input: { groupId, title: check, dueDate } } });
      setAddedTasks((prev) => new Set(prev).add(`${groupId}:${check}`));
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <section className="briefing">
      <p className="muted">
        <Link to={`/farms/${briefing.farm.id}`}>{briefing.farm.name}</Link>
      </p>
      <h1>Morning briefing</h1>
      <p className="muted">
        {shortDay(briefing.date)} · updated {ukTime(briefing.generatedAt)}{' '}
        <button
          type="button"
          className="link-button"
          disabled={refreshState.loading}
          onClick={() => refresh({ variables }).catch((err) => setActionError(errorMessage(err)))}
        >
          Refresh
        </button>
      </p>
      {briefing.isStale && (
        <p className="error" role="alert">
          Showing the briefing from {shortDay(briefing.date)} (updated{' '}
          {ukTime(briefing.generatedAt)}) because we couldn’t fetch today’s weather.
        </p>
      )}
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}
      <Disclaimer />

      {briefing.overdueTasks.length > 0 && (
        <section className="overdue" aria-labelledby="overdue-heading">
          <h2 id="overdue-heading">Overdue tasks</h2>
          <ul className="checks">
            {briefing.overdueTasks.map((task) => (
              <li key={task.id}>
                <span>
                  <strong>{task.title}</strong>
                  <br />
                  <span className="muted">
                    {task.group.name} · was due {shortDay(task.dueDate)}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Done: ${task.title}`}
                  onClick={() => setTaskDone({ variables: { id: task.id, done: true } })}
                >
                  Done
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {briefing.groups.length === 0 && (
        <p className="muted">Nothing to flag this week for any of your groups.</p>
      )}
      {briefing.groups.map((group) => {
        const heading = group.fieldName
          ? `${group.groupName} · ${group.fieldName}`
          : group.groupName;
        return (
          <section
            key={group.groupId}
            className="card briefing-group"
            aria-labelledby={`bg-${group.groupId}`}
          >
            <h2 id={`bg-${group.groupId}`}>{heading}</h2>
            {group.items.map((item) => (
              <Item
                key={item.riskId}
                item={item}
                added={(check) => addedTasks.has(`${group.groupId}:${check}`)}
                onAddTask={(check) => addTask(group.groupId, item, check)}
              />
            ))}
          </section>
        );
      })}

      {briefing.quietGroups.length > 0 && (
        <details className="quiet">
          <summary>No concerns this week ({briefing.quietGroups.length})</summary>
          <ul>
            {briefing.quietGroups.map((g) => (
              <li key={g.groupId}>{g.groupName}</li>
            ))}
          </ul>
        </details>
      )}

      <h2>Daily email</h2>
      <BriefingEmailSettings farmId={briefing.farm.id} />
    </section>
  );
}
