import { useMutation, useQuery } from '@apollo/client';
import { Link, useParams } from 'react-router-dom';
import { CLASS_LABELS } from '../components/GroupForm';
import { ObservationForm, type ObservationFormValues } from '../components/ObservationForm';
import { TreatmentForm, type TreatmentFormValues } from '../components/TreatmentForm';
import { shortDay } from '../dates';
import { GROUP_QUERY, RECORD_OBSERVATION, RECORD_TREATMENT } from '../graphql/records';
import type { GroupRecords, WithdrawalStatus } from '../types';

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
          {group.treatments.map((t) => (
            <li key={t.id} className="log__row">
              <span>
                <strong>{shortDay(t.date)}</strong> · {t.productName}
                {t.batchNumber ? ` (batch ${t.batchNumber})` : ''}
                <br />
                <span className="muted">
                  {t.animalsTreated} animals · given by {t.administeredBy}
                  {t.reason ? ` · ${t.reason}` : ''}
                </span>
              </span>
              <span className="log__due">
                Meat withdrawal ends {shortDay(t.meatWithdrawalEnds)}
                {t.milkWithdrawalEnds ? ` · milk ${shortDay(t.milkWithdrawalEnds)}` : ''}
              </span>
            </li>
          ))}
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
            <li key={o.id} className="log__row">
              <span>
                <strong>{shortDay(o.date)}</strong> · {o.type}
                {o.note ? ` · ${o.note}` : ''}
              </span>
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
