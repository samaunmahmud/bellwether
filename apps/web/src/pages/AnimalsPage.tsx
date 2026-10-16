import { useMutation, useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { PetForm, type PetFormValues } from '../components/PetForm';
import { isOverdue, shortDay } from '../dates';
import { ANIMALS_QUERY, CREATE_ANIMAL } from '../graphql/queries';
import type { Animal } from '../types';

/** The next due date still to come or most overdue, across the pet's log. */
function nextDue(animal: Animal): string | null {
  const dates = animal.logs.map((l) => l.nextDueDate).filter((d): d is string => d !== null);
  return dates.sort()[0] ?? null;
}

export function AnimalsPage() {
  const { data, loading, error } = useQuery<{ animals: Animal[] }>(ANIMALS_QUERY);
  const [createAnimal] = useMutation(CREATE_ANIMAL, {
    refetchQueries: [{ query: ANIMALS_QUERY }],
  });

  async function handleCreate(values: PetFormValues) {
    await createAnimal({ variables: { ...values, category: 'PET' } });
  }

  return (
    <section>
      <h1>My pets</h1>
      <p className="muted">
        Add a pet with its home postcode to get its own tick and heat forecast, and keep a log of
        checks and treatments with &ldquo;next due&rdquo; reminders. Livestock lives under{' '}
        <Link to="/farms">My farms</Link>.
      </p>

      <PetForm onSubmit={handleCreate} />

      {loading && <p aria-live="polite">Loading…</p>}
      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}
      {data && data.animals.length === 0 && (
        <p className="muted">No pets yet. Add one above to start a log.</p>
      )}

      <div className="grid">
        {data?.animals.map((animal) => {
          const due = nextDue(animal);
          const overdueCount = animal.logs.filter((l) => isOverdue(l.nextDueDate)).length;
          return (
            <article key={animal.id} className="card">
              <h3>
                <Link to={`/pets/${animal.id}`}>{animal.name}</Link>
              </h3>
              <p className="muted">
                {animal.species}
                {animal.category === 'FARM' ? ' · farm' : ''}
                {animal.postcode ? ` · ${animal.postcode}` : ' · no postcode yet'}
              </p>
              {overdueCount > 0 ? (
                <p className="pill pill--overdue">
                  Overdue: {overdueCount} {overdueCount === 1 ? 'entry' : 'entries'}
                </p>
              ) : due ? (
                <p>Next due: {shortDay(due)}</p>
              ) : (
                <p className="muted">Nothing due</p>
              )}
              <p className="muted">
                {animal.logs.length} log {animal.logs.length === 1 ? 'entry' : 'entries'}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
