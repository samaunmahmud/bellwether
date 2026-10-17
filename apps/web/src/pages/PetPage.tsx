import { useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';
import { PageHero } from '../components/photos';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ForecastView } from '../components/ForecastView';
import { LogForm, type LogFormValues } from '../components/LogForm';
import { PetForm, type PetFormValues } from '../components/PetForm';
import { PetHealth } from '../components/PetHealth';
import { isOverdue, shortDay } from '../dates';
import {
  ADD_LOG_ENTRY,
  ANIMALS_QUERY,
  DELETE_ANIMAL,
  DELETE_LOG_ENTRY,
  PET_QUERY,
  UPDATE_ANIMAL,
  UPDATE_LOG_ENTRY,
} from '../graphql/queries';
import type { LogEntry, Pet } from '../types';

/** One pet: its own forecast, profile and log (FR-2.6). */
export function PetPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error } = useQuery<{ animal: Pet | null }>(PET_QUERY, {
    variables: { id },
  });
  const refetch = { refetchQueries: [{ query: PET_QUERY, variables: { id } }] };
  const [updateAnimal] = useMutation(UPDATE_ANIMAL, refetch);
  const [deleteAnimal] = useMutation(DELETE_ANIMAL, {
    refetchQueries: [{ query: ANIMALS_QUERY }],
  });
  const [addLog] = useMutation(ADD_LOG_ENTRY, refetch);
  const [updateLog] = useMutation(UPDATE_LOG_ENTRY, refetch);
  const [deleteLog] = useMutation(DELETE_LOG_ENTRY, refetch);
  const [editingPet, setEditingPet] = useState(false);
  const [editingLog, setEditingLog] = useState<string | null>(null);

  if (loading) return <p aria-live="polite">Loading…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  const pet = data?.animal;
  if (!pet)
    return (
      <p>
        Pet not found. <Link to="/animals">Back to my pets</Link>
      </p>
    );

  async function savePet(values: PetFormValues) {
    const { name, postcode, highExposureHabitat } = values;
    await updateAnimal({ variables: { id, input: { name, postcode, highExposureHabitat } } });
    setEditingPet(false);
  }

  async function removePet() {
    if (!window.confirm(`Delete ${pet!.name} and their whole log? This can't be undone.`)) return;
    await deleteAnimal({ variables: { id } });
    navigate('/animals');
  }

  async function saveLog(logId: string, input: LogFormValues) {
    await updateLog({ variables: { id: logId, input } });
    setEditingLog(null);
  }

  return (
    <section>
      <PageHero photo="dog" eyebrow={<Link to="/animals">← My pets</Link>}>
        <div>
          <h1>{pet.name}</h1>
          <p className="muted">
            {pet.species}
            {pet.postcode ? ` · ${pet.postcode}` : ''}
            {pet.highExposureHabitat ? ' · walks in long grass or woodland' : ''}
          </p>
        </div>
        {!editingPet && (
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setEditingPet(true)}>
              Edit details
            </button>
            <button
              type="button"
              className="danger"
              aria-label={`Delete ${pet.name}`}
              onClick={removePet}
            >
              Delete
            </button>
          </div>
        )}
      </PageHero>

      {editingPet && (
        <PetForm initial={pet} onSubmit={savePet} onCancel={() => setEditingPet(false)} />
      )}

      <label className="toggle reminder-toggle">
        <input
          type="checkbox"
          checked={pet.remindersEnabled}
          onChange={(e) =>
            updateAnimal({ variables: { id, input: { remindersEnabled: e.target.checked } } })
          }
        />
        <span>
          Email me reminders
          <small className="muted">
            {' '}
            A week before, on the day and 3 days after anything in the health plan is due.
          </small>
        </span>
      </label>

      <PetHealth
        // Remount after any log change so the plan and weights refetch.
        key={pet.logs.map((l) => `${l.id}:${l.nextDueDate ?? ''}`).join(',')}
        petId={pet.id}
      />

      <h2>Forecast</h2>
      {pet.forecast ? (
        <ForecastView forecast={pet.forecast} />
      ) : (
        <p className="muted">
          Add a home postcode with &ldquo;Edit details&rdquo; to see {pet.name}&apos;s 14-day risk
          forecast.
        </p>
      )}

      <h2>Log</h2>
      <LogForm onSubmit={(values) => addLog({ variables: { animalId: id, ...values } })} />
      {pet.logs.length === 0 ? (
        <p className="muted">No entries yet.</p>
      ) : (
        <ul className="log">
          {pet.logs.map((log) =>
            editingLog === log.id ? (
              <li key={log.id} className="log__row">
                <LogForm
                  initial={log}
                  submitLabel="Save changes"
                  onSubmit={(values) => saveLog(log.id, values)}
                  onCancel={() => setEditingLog(null)}
                />
              </li>
            ) : (
              <LogRow
                key={log.id}
                log={log}
                onEdit={() => setEditingLog(log.id)}
                onDelete={() => deleteLog({ variables: { id: log.id } })}
              />
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function LogRow(props: { log: LogEntry; onEdit: () => void; onDelete: () => void }) {
  const { log } = props;
  const overdue = isOverdue(log.nextDueDate);
  return (
    <li className={overdue ? 'log__row log__row--overdue' : 'log__row'}>
      <span>
        <strong>{log.type}</strong> · {shortDay(log.date)}
        {log.note ? ` · ${log.note}` : ''}
      </span>
      {log.nextDueDate && (
        <span className="log__due">
          {overdue ? 'Overdue: ' : 'Next due: '}
          {shortDay(log.nextDueDate)}
        </span>
      )}
      <span className="log__actions">
        <button
          type="button"
          className="link-button"
          aria-label={`Edit ${log.type} entry`}
          onClick={props.onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="link-button"
          aria-label={`Delete ${log.type} entry`}
          onClick={props.onDelete}
        >
          Delete
        </button>
      </span>
    </li>
  );
}
