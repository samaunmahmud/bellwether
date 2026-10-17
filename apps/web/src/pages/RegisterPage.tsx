import { useMutation, useQuery } from '@apollo/client';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { KINDS, RegisterEventForm } from '../components/RegisterEventForm';
import { useToast } from '../components/Toasts';
import { toCsv } from '../csv';
import { dayMonth, shortDay } from '../dates';
import { errorMessage } from '../errors';
import { RECORD_REGISTER_EVENT, REGISTER_QUERY, VOID_REGISTER_EVENT } from '../graphql/v3';
import { canWork } from '../roles';
import type { FarmRole, RegisterEvent, RegisterEventKind } from '../types';

interface RegisterData {
  farm: {
    id: string;
    name: string;
    cphNumber: string | null;
    flockMark: string | null;
    myRole: FarmRole;
    groups: Array<{ id: string; name: string; headCount: number }>;
  } | null;
  holdingRegister: Array<{ headCountAfter: number | null; event: RegisterEvent }>;
  registerEvents: RegisterEvent[];
}

const MEASUREMENTS: RegisterEventKind[] = ['WEIGHING', 'FEC', 'BODY_CONDITION'];

/** One line describing an entry's details, for the table and the export. */
export function eventDetails(e: RegisterEvent): string {
  const parts: string[] = [];
  switch (e.kind) {
    case 'BIRTH':
      parts.push(`${e.count ?? 0} alive, ${e.bornDead ?? 0} dead`);
      break;
    case 'MOVE_ON':
      parts.push(`${e.count} from ${e.otherParty}`);
      break;
    case 'MOVE_OFF':
      parts.push(`${e.count} to ${e.otherParty}`);
      break;
    case 'WEIGHING':
      parts.push(`${e.count} weighed, average ${e.value} kg`);
      break;
    case 'FEC':
      parts.push(`${e.value} eggs per gram from ${e.count} samples`);
      break;
    case 'BODY_CONDITION':
      parts.push(`Average ${e.value} from ${e.count} scored`);
      break;
    default:
      parts.push(String(e.count ?? ''));
  }
  if (e.cause) parts.push(e.cause);
  if (e.reference) parts.push(`Ref ${e.reference}`);
  if (e.note) parts.push(e.note);
  return parts.join(' · ');
}

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** v3: the holding register (births, deaths, moves, tags, counts) and the measurements log. */
export function RegisterPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [view, setView] = useState<'register' | 'measurements'>('register');
  const { data, loading, error } = useQuery<RegisterData>(REGISTER_QUERY, {
    variables: { farmId: id },
  });
  const refetch = { refetchQueries: [{ query: REGISTER_QUERY, variables: { farmId: id } }] };
  const [record] = useMutation(RECORD_REGISTER_EVENT, refetch);
  const [voidEvent] = useMutation(VOID_REGISTER_EVENT, refetch);

  const recordKind = params.get('record') as RegisterEventKind | null;
  const measurements = useMemo(
    () => (data?.registerEvents ?? []).filter((e) => MEASUREMENTS.includes(e.kind)),
    [data],
  );

  if (loading) return <p aria-live="polite">Loading the register…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  if (!data?.farm) return <h1>Farm not found</h1>;
  const { farm, holdingRegister } = data;
  const worker = canWork(farm.myRole);
  const closeForm = () => setParams({}, { replace: true });

  async function handleVoid(e: RegisterEvent) {
    const reason = window.prompt(`Why void this ${KINDS[e.kind].label.toLowerCase()} entry?`);
    if (!reason) return;
    try {
      await voidEvent({ variables: { id: e.id, reason } });
      toast('Entry voided. It stays in the register, struck through.');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  function exportCsv() {
    download(
      `holding-register-${farm.name.replace(/\W+/g, '-').toLowerCase()}.csv`,
      toCsv([
        ['Holding', farm.name, 'CPH', farm.cphNumber, 'Flock/herd mark', farm.flockMark],
        [],
        ['Date', 'Group', 'Entry', 'Details', 'Head count after', 'Recorded by'],
        ...holdingRegister.map(({ event: e, headCountAfter }) => [
          e.date,
          e.group.name,
          KINDS[e.kind].label,
          eventDetails(e),
          headCountAfter,
          e.recordedBy,
        ]),
      ]),
    );
  }

  const rows =
    view === 'register'
      ? holdingRegister.map((r) => r)
      : measurements.map((event) => ({ event, headCountAfter: null }));

  return (
    <section>
      <p className="muted">
        <Link to={`/farms/${farm.id}`}>{farm.name}</Link>
      </p>
      <header className="page-title">
        <div>
          <h1>Holding register</h1>
          <p className="lead">
            {farm.cphNumber ? `CPH ${farm.cphNumber}` : 'No CPH number yet'}
            {farm.flockMark ? ` · Mark ${farm.flockMark}` : ''}
            {!farm.cphNumber && (
              <>
                {' · '}
                <Link to={`/farms/${farm.id}/settings`}>Add holding details</Link>
              </>
            )}
          </p>
        </div>
        <div className="actions no-print">
          {worker && !recordKind && (
            <button type="button" onClick={() => setParams({ record: 'DEATH' })}>
              Record an entry
            </button>
          )}
          <button type="button" className="secondary" onClick={exportCsv}>
            Download CSV
          </button>
          <button type="button" className="secondary" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </header>

      <ul className="group-counts" aria-label="Head count now">
        {farm.groups.map((g) => (
          <li key={g.id}>
            <Link to={`/groups/${g.id}`}>{g.name}</Link>
            <strong>{g.headCount.toLocaleString('en-GB')}</strong>
          </li>
        ))}
      </ul>

      {worker && recordKind && (
        <section className="panel no-print" aria-labelledby="record-heading">
          <h2 id="record-heading">Record an entry</h2>
          <RegisterEventForm
            key={recordKind}
            groups={farm.groups}
            initialKind={recordKind in KINDS ? recordKind : 'DEATH'}
            onCancel={closeForm}
            onSubmit={async (values) => {
              await record({ variables: { input: values } });
              toast(`${KINDS[values.kind].label} recorded`);
            }}
          />
        </section>
      )}

      <div className="tabs no-print" role="tablist" aria-label="Show">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'register'}
          className={view === 'register' ? 'tab is-active' : 'tab'}
          onClick={() => setView('register')}
        >
          Register ({holdingRegister.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'measurements'}
          className={view === 'measurements' ? 'tab is-active' : 'tab'}
          onClick={() => setView('measurements')}
        >
          Weights, egg counts and condition ({measurements.length})
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="empty">
          {view === 'register'
            ? 'No births, deaths, moves or counts recorded yet.'
            : 'No weighings, egg counts or condition scores yet.'}
        </p>
      ) : (
        <div className="table-scroll">
          <table className="records register-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Group</th>
                <th scope="col">Entry</th>
                <th scope="col">Details</th>
                {view === 'register' && <th scope="col">Head after</th>}
                <th scope="col">Recorded by</th>
                {worker && (
                  <th scope="col" className="no-print">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ event: e, headCountAfter }) => (
                <tr key={e.id} className={e.voided ? 'records__voided' : undefined}>
                  <td>
                    <span className="print-only">{e.date}</span>
                    <span className="no-print">{shortDay(e.date)}</span>
                  </td>
                  <td>
                    <Link to={`/groups/${e.group.id}`}>{e.group.name}</Link>
                  </td>
                  <td>
                    <span className={`kind kind--${e.kind.toLowerCase()}`}>
                      {KINDS[e.kind].label}
                    </span>
                  </td>
                  <td>{eventDetails(e)}</td>
                  {view === 'register' && <td>{headCountAfter ?? '–'}</td>}
                  <td>{e.voided ? `Voided: ${e.voidReason}` : e.recordedBy}</td>
                  {worker && (
                    <td className="no-print">
                      {!e.voided && (
                        <button
                          type="button"
                          className="link-button"
                          aria-label={`Void ${KINDS[e.kind].label.toLowerCase()} on ${dayMonth(e.date)}`}
                          onClick={() => handleVoid(e)}
                        >
                          Void
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted register-note">
        Keepers must report movements to the relevant service (for example LIS, BCMS or ScotEID) and
        take a head count on 1 December. Bellwether keeps the record; it doesn’t report for you.
      </p>
    </section>
  );
}
