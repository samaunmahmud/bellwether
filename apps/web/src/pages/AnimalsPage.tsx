import { useMutation, useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { daysUntil, dueText } from '../components/PetHealth';
import { PetForm, type PetFormValues } from '../components/PetForm';
import { Photo } from '../components/photos';
import { shortDay } from '../dates';
import { ANIMALS_QUERY, CREATE_ANIMAL } from '../graphql/queries';
import type { Animal } from '../types';

/** What's due for a pet: the latest entry of each type with a next due date, soonest first. */
function plan(animal: Animal) {
  const latest = new Map<string, Animal['logs'][number]>();
  for (const log of animal.logs) if (!latest.has(log.type)) latest.set(log.type, log);
  return [...latest.values()]
    .filter((l): l is typeof l & { nextDueDate: string } => l.nextDueDate !== null)
    .map((l) => ({ type: l.type, date: l.nextDueDate, days: daysUntil(l.nextDueDate) }))
    .sort((a, b) => a.days - b.days);
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
      <header className="page-hero">
        <Photo name="dog" className="photo--drift" />
        <div className="page-hero__inner">
          <h1>My pets</h1>
          <p>
            Each pet gets its own tick and heat forecast at home, a health plan with reminders and a
            weight chart. Livestock lives under <Link to="/farms">My farms</Link>.
          </p>
        </div>
      </header>

      {loading && (
        <div className="pet-tiles" aria-busy="true">
          <div className="skeleton skeleton--tile" />
          <div className="skeleton skeleton--tile" />
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}
      {data && data.animals.length === 0 && (
        <p className="empty">No pets yet. Add one below to start a log.</p>
      )}

      {data && data.animals.length > 0 && (
        <ul className="pet-tiles">
          {data.animals.map((animal, i) => {
            const items = plan(animal);
            const overdue = items.filter((p) => p.days < 0);
            const next = items.find((p) => p.days >= 0);
            return (
              <li key={animal.id} style={{ ['--i' as string]: i }}>
                <Link to={`/pets/${animal.id}`} className="pet-tile">
                  <span className={`pet-tile__avatar pet-tile__avatar--${animal.species}`}>
                    <Icon name="pets" size={26} />
                  </span>
                  <span className="pet-tile__main">
                    <strong className="pet-tile__name">{animal.name}</strong>
                    <span className="muted">
                      {animal.species}
                      {animal.postcode ? ` · ${animal.postcode}` : ' · no postcode yet'}
                      {animal.highExposureHabitat ? ' · walks in long grass' : ''}
                    </span>
                    <span className="pet-tile__chips">
                      {overdue.map((p) => (
                        <span key={p.type} className="tag tag--overdue">
                          {p.type} overdue · {shortDay(p.date)}
                        </span>
                      ))}
                      {next && (
                        <span className="tag">
                          {next.type} {dueText(next.days).toLowerCase()}
                        </span>
                      )}
                      {items.length === 0 && <span className="tag tag--quiet">Nothing due</span>}
                    </span>
                  </span>
                  <Icon name="arrow" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <section className="panel" aria-labelledby="add-pet">
        <h2 id="add-pet">Add a pet</h2>
        <PetForm onSubmit={handleCreate} />
      </section>
    </section>
  );
}
