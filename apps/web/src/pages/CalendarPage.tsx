import { useQuery } from '@apollo/client';
import { useMemo, useState } from 'react';
import { PageHero } from '../components/photos';
import { Link, useParams } from 'react-router-dom';
import { KINDS } from '../components/RegisterEventForm';
import { shortDay, todayIso } from '../dates';
import { CALENDAR_QUERY } from '../graphql/v3';
import type { RegisterEvent } from '../types';

interface CalendarData {
  farm: {
    id: string;
    name: string;
    groups: Array<{
      id: string;
      name: string;
      lambingStart: string | null;
      lambingEnd: string | null;
      calvingStart: string | null;
      calvingEnd: string | null;
      withdrawal: { meatEnds: string | null; milkEnds: string | null };
    }>;
  } | null;
  tasks: Array<{
    id: string;
    title: string;
    dueDate: string;
    done: boolean;
    overdue: boolean;
    group: { name: string } | null;
  }>;
  registerEvents: RegisterEvent[];
  medicines: Array<{ id: string; productName: string; expiryDate: string | null; status: string }>;
}

export type EntryKind = 'task' | 'done' | 'withdrawal' | 'season' | 'record' | 'medicine';

export interface CalendarEntry {
  date: string;
  kind: EntryKind;
  text: string;
  to?: string;
}

const KIND_WORD: Record<EntryKind, string> = {
  task: 'Task',
  done: 'Done',
  withdrawal: 'Withdrawal ends',
  season: 'Season',
  record: 'Record',
  medicine: 'Medicine',
};

const iso = (d: Date) => todayIso(d);

/** Every day from `start` to `end`, inclusive (capped at a year to stay sensible). */
function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  while (iso(d) <= end && days.length < 366) {
    days.push(iso(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/** Everything dated on the farm, flattened into calendar entries. */
export function calendarEntries(data: CalendarData): CalendarEntry[] {
  const farm = data.farm!;
  const entries: CalendarEntry[] = [];
  for (const t of data.tasks)
    entries.push({
      date: t.dueDate,
      kind: t.done ? 'done' : 'task',
      text: `${t.title}${t.group ? ` (${t.group.name})` : ''}`,
      to: `/farms/${farm.id}/tasks`,
    });
  for (const g of farm.groups) {
    for (const [label, end] of [
      ['meat', g.withdrawal.meatEnds],
      ['milk', g.withdrawal.milkEnds],
    ] as const)
      if (end)
        entries.push({
          date: end,
          kind: 'withdrawal',
          text: `${g.name}: ${label} withdrawal ends`,
          to: `/groups/${g.id}`,
        });
    for (const [label, start, end] of [
      ['Lambing', g.lambingStart, g.lambingEnd],
      ['Calving', g.calvingStart, g.calvingEnd],
    ] as const)
      if (start && end)
        for (const day of eachDay(start, end))
          entries.push({
            date: day,
            kind: 'season',
            text: `${label}: ${g.name}`,
            to: `/groups/${g.id}`,
          });
  }
  for (const e of data.registerEvents.filter((e) => !e.voided))
    entries.push({
      date: e.date,
      kind: 'record',
      text: `${KINDS[e.kind].label}: ${e.group.name}${e.count !== null ? ` (${e.count})` : ''}`,
      to: `/farms/${farm.id}/register`,
    });
  for (const m of data.medicines)
    if (m.expiryDate && m.status !== 'FINISHED')
      entries.push({
        date: m.expiryDate,
        kind: 'medicine',
        text: `${m.productName} expires`,
        to: `/farms/${farm.id}/medicines`,
      });
  return entries;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The weeks shown for a month: Monday to Sunday, padded with the neighbouring months' days. */
export function monthGrid(year: number, month: number): string[][] {
  const first = new Date(year, month, 1, 12);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const weeks: string[][] = [];
  const d = new Date(start);
  do {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(iso(d));
      d.setDate(d.getDate() + 1);
    }
    weeks.push(week);
  } while (d.getMonth() === month);
  return weeks;
}

/** v3: a month view of tasks, withdrawals, lambing and calving, records and medicine expiry. */
export function CalendarPage() {
  const { id = '' } = useParams();
  const today = todayIso();
  const [cursor, setCursor] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)) - 1,
  }));
  const [selected, setSelected] = useState(today);
  const [hidden, setHidden] = useState<Set<EntryKind>>(new Set());
  const { data, loading, error } = useQuery<CalendarData>(CALENDAR_QUERY, { variables: { id } });

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    if (data?.farm)
      for (const e of calendarEntries(data)) {
        if (hidden.has(e.kind)) continue;
        map.set(e.date, [...(map.get(e.date) ?? []), e]);
      }
    return map;
  }, [data, hidden]);

  if (loading) return <p aria-live="polite">Loading the calendar…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  if (!data?.farm) return <h1>Farm not found</h1>;

  const weeks = monthGrid(cursor.year, cursor.month);
  const monthName = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
  const shift = (n: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + n, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const dayEntries = byDate.get(selected) ?? [];

  return (
    <section>
      <PageHero photo="lambs" eyebrow={<Link to={`/farms/${data.farm.id}`}>{data.farm.name}</Link>}>
        <h1>Calendar</h1>
        <div className="calendar__nav">
          <button
            type="button"
            className="secondary"
            onClick={() => shift(-1)}
            aria-label="Previous month"
          >
            ‹
          </button>
          <h2 className="calendar__month" aria-live="polite">
            {monthName}
          </h2>
          <button
            type="button"
            className="secondary"
            onClick={() => shift(1)}
            aria-label="Next month"
          >
            ›
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setCursor({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 });
              setSelected(today);
            }}
          >
            Today
          </button>
        </div>
      </PageHero>

      <fieldset className="chips">
        <legend className="visually-hidden">Show</legend>
        {(Object.keys(KIND_WORD) as EntryKind[]).map((k) => (
          <label key={k} className={hidden.has(k) ? 'chip' : 'chip is-active'}>
            <input
              type="checkbox"
              checked={!hidden.has(k)}
              onChange={() =>
                setHidden((h) => {
                  const next = new Set(h);
                  if (next.has(k)) next.delete(k);
                  else next.add(k);
                  return next;
                })
              }
            />
            <span className={`cal-dot cal-dot--${k}`} aria-hidden="true" />
            {KIND_WORD[k]}
          </label>
        ))}
      </fieldset>

      <div className="calendar-layout">
        <table className="calendar" aria-label={monthName}>
          <thead>
            <tr>
              {WEEKDAYS.map((d) => (
                <th key={d} scope="col">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]}>
                {week.map((day) => {
                  const entries = byDate.get(day) ?? [];
                  const outside = Number(day.slice(5, 7)) - 1 !== cursor.month;
                  const classes = [
                    'calendar__day',
                    outside && 'is-outside',
                    day === today && 'is-today',
                    day === selected && 'is-selected',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <td key={day}>
                      <button
                        type="button"
                        className={classes}
                        aria-pressed={day === selected}
                        aria-label={`${shortDay(day)}${entries.length ? `, ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}` : ''}`}
                        onClick={() => setSelected(day)}
                      >
                        <span className="calendar__date">{Number(day.slice(8))}</span>
                        <span className="calendar__entries" aria-hidden="true">
                          {entries.slice(0, 3).map((e, i) => (
                            <span key={i} className={`cal-entry cal-entry--${e.kind}`}>
                              {e.text}
                            </span>
                          ))}
                          {entries.length > 3 && (
                            <span className="cal-more">+{entries.length - 3} more</span>
                          )}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <aside className="panel calendar__day-panel" aria-live="polite">
          <h2>{shortDay(selected)}</h2>
          {dayEntries.length === 0 ? (
            <p className="muted">Nothing on this day.</p>
          ) : (
            <ul className="day-list">
              {dayEntries.map((e, i) => (
                <li key={i}>
                  <span className={`cal-dot cal-dot--${e.kind}`} aria-hidden="true" />
                  <span className="muted">{KIND_WORD[e.kind]}</span>
                  {e.to ? <Link to={e.to}>{e.text}</Link> : <span>{e.text}</span>}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}
