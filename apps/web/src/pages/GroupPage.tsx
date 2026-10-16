import { useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CLASS_LABELS } from '../components/GroupForm';
import { ObservationForm, type ObservationFormValues } from '../components/ObservationForm';
import { RecordHistory } from '../components/RecordHistory';
import { TreatmentForm, type TreatmentFormValues } from '../components/TreatmentForm';
import { VoidForm } from '../components/VoidForm';
import { shortDay } from '../dates';
import {
  CORRECT_OBSERVATION,
  CORRECT_TREATMENT,
  GROUP_QUERY,
  RECORD_OBSERVATION,
  RECORD_TREATMENT,
  VOID_OBSERVATION,
  VOID_TREATMENT,
} from '../graphql/records';
import type { Correctable, GroupRecords, WithdrawalStatus } from '../types';

/** Which record, if any, is open for correcting or voiding (FR-6.5). */
type Editing = { id: string; mode: 'correct' | 'void' } | null;

function Voided({ record }: { record: Correctable }) {
  return record.voided ? <span className="pill">Voided: {record.voidReason}</span> : null;
}

function RecordActions(props: {
  label: string;
  record: Correctable;
  onCorrect: () => void;
  onVoid: () => void;
}) {
  if (props.record.voided) return null;
  return (
    <span className="log__actions">
      <button
        type="button"
        className="link-button"
        aria-label={`Correct ${props.label}`}
        onClick={props.onCorrect}
      >
        Correct
      </button>
      <button
        type="button"
        className="link-button"
        aria-label={`Void ${props.label}`}
        onClick={props.onVoid}
      >
        Void
      </button>
    </span>
  );
}

/** FR-6.2: withdrawal shown in words, never by colour alone. */
function Withdrawal({ status }: { status: WithdrawalStatus }) {
  if (!status.inWithdrawal)
    return (
      <p role="status" className="withdrawal withdrawal--clear">
        Not in withdrawal
      </p>
    );
  return (
    <p role="status" className="withdrawal withdrawal--active">
      <strong>In withdrawal</strong>
      {status.meatEnds && <span> · Meat: ends {shortDay(status.meatEnds)}</span>}
      {status.milkEnds && <span> · Milk: ends {shortDay(status.milkEnds)}</span>}
    </p>
  );
}

/** One livestock group's records: withdrawal status, treatments and checks (FR-6). */
export function GroupPage() {
  const { id = '' } = useParams();
  const { data, loading, error } = useQuery<{ livestockGroup: GroupRecords | null }>(GROUP_QUERY, {
    variables: { id },
  });
  const refetch = { refetchQueries: [{ query: GROUP_QUERY, variables: { id } }] };
  const [recordTreatment] = useMutation(RECORD_TREATMENT, refetch);
  const [recordObservation] = useMutation(RECORD_OBSERVATION, refetch);
  const [correctTreatment] = useMutation(CORRECT_TREATMENT, refetch);
  const [voidTreatment] = useMutation(VOID_TREATMENT, refetch);
  const [correctObservation] = useMutation(CORRECT_OBSERVATION, refetch);
  const [voidObservation] = useMutation(VOID_OBSERVATION, refetch);
  const [editing, setEditing] = useState<Editing>(null);
  const close = () => setEditing(null);
  const isOpen = (id: string, mode: 'correct' | 'void') =>
    editing?.id === id && editing.mode === mode;

  if (loading) return <p aria-live="polite">Loading records…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  const group = data?.livestockGroup;
  if (!group) return <h1>Group not found</h1>;

  return (
    <section>
      <p className="muted">
        <Link to={`/farms/${group.farm.id}`}>{group.farm.name}</Link>
      </p>
      <h1>{group.name}</h1>
      <p className="muted">
        {group.headCount} {CLASS_LABELS[group.livestockClass].toLowerCase()}
      </p>
      <Withdrawal status={group.withdrawal} />

      <h2>Treatments</h2>
      {group.treatments.length === 0 ? (
        <p className="muted">No treatments recorded.</p>
      ) : (
        <ul className="log" aria-label="Treatments">
          {group.treatments.map((t) => {
            const label = `${t.productName} on ${shortDay(t.date)}`;
            return (
              <li key={t.id} className={t.voided ? 'log__row log__row--voided' : 'log__row'}>
                <span>
                  <strong>{shortDay(t.date)}</strong> ·{' '}
                  <span className="log__text">
                    {t.productName}
                    {t.batchNumber ? ` (batch ${t.batchNumber})` : ''}
                  </span>
                  <br />
                  <span className="muted">
                    {t.animalsTreated} animals · given by {t.administeredBy}
                    {t.reason ? ` · ${t.reason}` : ''}
                  </span>
                  <br />
                  <Voided record={t} />
                </span>
                <span className="log__due">
                  {t.voided ? (
                    'Not counted for withdrawal'
                  ) : (
                    <>
                      Meat withdrawal ends {shortDay(t.meatWithdrawalEnds)}
                      {t.milkWithdrawalEnds ? ` · milk ${shortDay(t.milkWithdrawalEnds)}` : ''}
                    </>
                  )}
                </span>
                <RecordActions
                  label={label}
                  record={t}
                  onCorrect={() => setEditing({ id: t.id, mode: 'correct' })}
                  onVoid={() => setEditing({ id: t.id, mode: 'void' })}
                />
                <RecordHistory history={t.history} />
                {isOpen(t.id, 'correct') && (
                  <TreatmentForm
                    headCount={group.headCount}
                    initial={t}
                    onCancel={close}
                    onSubmit={async (values, reason) => {
                      await correctTreatment({ variables: { id: t.id, input: values, reason } });
                      close();
                    }}
                  />
                )}
                {isOpen(t.id, 'void') && (
                  <VoidForm
                    onCancel={close}
                    onVoid={async (reason) => {
                      await voidTreatment({ variables: { id: t.id, reason } });
                      close();
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <TreatmentForm
        headCount={group.headCount}
        onSubmit={(values: TreatmentFormValues) =>
          recordTreatment({ variables: { input: { groupId: group.id, ...values } } })
        }
      />

      <h2>Checks and observations</h2>
      {group.observations.length === 0 ? (
        <p className="muted">No checks recorded.</p>
      ) : (
        <ul className="log" aria-label="Checks">
          {group.observations.map((o) => (
            <li key={o.id} className={o.voided ? 'log__row log__row--voided' : 'log__row'}>
              <span>
                <strong>{shortDay(o.date)}</strong> ·{' '}
                <span className="log__text">
                  {o.type}
                  {o.note ? ` · ${o.note}` : ''}
                </span>
                <br />
                <Voided record={o} />
              </span>
              <RecordActions
                label={`${o.type} on ${shortDay(o.date)}`}
                record={o}
                onCorrect={() => setEditing({ id: o.id, mode: 'correct' })}
                onVoid={() => setEditing({ id: o.id, mode: 'void' })}
              />
              <RecordHistory history={o.history} />
              {isOpen(o.id, 'correct') && (
                <ObservationForm
                  species={group.species}
                  initial={o}
                  onCancel={close}
                  onSubmit={async (values, reason) => {
                    await correctObservation({ variables: { id: o.id, input: values, reason } });
                    close();
                  }}
                />
              )}
              {isOpen(o.id, 'void') && (
                <VoidForm
                  onCancel={close}
                  onVoid={async (reason) => {
                    await voidObservation({ variables: { id: o.id, reason } });
                    close();
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <ObservationForm
        species={group.species}
        onSubmit={(values: ObservationFormValues) =>
          recordObservation({ variables: { input: { groupId: group.id, ...values } } })
        }
      />
    </section>
  );
}
