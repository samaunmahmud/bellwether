import { useMutation, useQuery } from '@apollo/client';
import { useState, type FormEvent } from 'react';
import { LogForm, type LogFormValues } from '../components/LogForm';
import { isOverdue, shortDay } from '../dates';
import { ADD_LOG_ENTRY, ANIMALS_QUERY, CREATE_ANIMAL, DELETE_LOG_ENTRY } from '../graphql/queries';
import type { Animal, AnimalCategory } from '../types';

const SPECIES: Record<AnimalCategory, string[]> = {
  PET: ['dog', 'cat'],
  FARM: ['cattle', 'sheep'],
};

export function AnimalsPage() {
  const { data, loading, error } = useQuery<{ animals: Animal[] }>(ANIMALS_QUERY);
  const refetch = { refetchQueries: [{ query: ANIMALS_QUERY }] };
  const [createAnimal] = useMutation(CREATE_ANIMAL, refetch);
  const [addLog] = useMutation(ADD_LOG_ENTRY, refetch);
  const [deleteLog] = useMutation(DELETE_LOG_ENTRY, refetch);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<AnimalCategory>('PET');
  const [species, setSpecies] = useState('dog');

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createAnimal({ variables: { name, species, category } });
    setName('');
  }

  return (
    <section>
      <h1>My animals and log</h1>

      <form className="form form--inline" onSubmit={handleCreate} aria-label="Add animal">
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bella or North field flock"
            required
          />
        </label>
        <label>
          Type
          <select
            value={category}
            onChange={(e) => {
              const next = e.target.value as AnimalCategory;
              setCategory(next);
              setSpecies(SPECIES[next][0]!);
            }}
          >
            <option value="PET">Pet</option>
            <option value="FARM">Farm animal / herd</option>
          </select>
        </label>
        <label>
          Species
          <select value={species} onChange={(e) => setSpecies(e.target.value)}>
            {SPECIES[category].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button type="submit">Add animal</button>
      </form>

      {loading && <p aria-live="polite">Loading…</p>}
      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}
      {data && data.animals.length === 0 && (
        <p className="muted">No animals yet. Add one above to start a log.</p>
      )}

      <div className="grid">
        {data?.animals.map((animal) => (
          <article key={animal.id} className="card">
            <header className="card__header">
              <div>
                <h3>{animal.name}</h3>
                <p className="muted">
                  {animal.species} · {animal.category === 'PET' ? 'pet' : 'farm'}
                </p>
              </div>
            </header>

            <LogForm
              onSubmit={(values: LogFormValues) =>
                addLog({ variables: { animalId: animal.id, ...values } })
              }
            />

            {animal.logs.length > 0 && (
              <ul className="log">
                {animal.logs.map((log) => {
                  const overdue = isOverdue(log.nextDueDate);
                  return (
                    <li
                      key={log.id}
                      className={overdue ? 'log__row log__row--overdue' : 'log__row'}
                    >
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
                      <button
                        type="button"
                        className="link-button"
                        aria-label={`Delete ${log.type} entry`}
                        onClick={() => deleteLog({ variables: { id: log.id } })}
                      >
                        Delete
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
