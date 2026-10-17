import { useQuery } from '@apollo/client';
import { ContactBook } from '../components/ContactBook';
import { NearbyLinks } from '../components/NearbyLinks';
import { PageHero } from '../components/photos';
import { CONTACTS_QUERY } from '../graphql/keeping';
import { ANIMALS_QUERY } from '../graphql/queries';
import type { Animal, Contact } from '../types';

/** v4: a user's own contacts (e.g. their pets' vet and pet shop), private to them. */
export function MyContactsPage() {
  const { data, loading, error } = useQuery<{ contacts: Contact[] }>(CONTACTS_QUERY);
  const pets = useQuery<{ animals: Animal[] }>(ANIMALS_QUERY);
  const postcodes = [
    ...new Map(
      (pets.data?.animals ?? [])
        .filter((a) => a.postcode)
        .map((a) => [a.postcode!, a.name] as const),
    ),
  ];

  return (
    <section>
      <PageHero photo="dog">
        <div>
          <h1>My contacts</h1>
          <p>Your pets’ vet, pet shop and anyone else you need. Only you can see these.</p>
        </div>
      </PageHero>
      {loading && <p aria-live="polite">Loading contacts…</p>}
      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}
      {data && (
        <div className="contacts-layout">
          <ContactBook
            contacts={data.contacts}
            farmId={null}
            canEdit
            refetch={{ query: CONTACTS_QUERY }}
          />
          <aside className="panel" aria-label="Find nearby">
            <h2>Find nearby</h2>
            {postcodes.length === 0 ? (
              <p className="muted">Add a home postcode to a pet to search near it.</p>
            ) : (
              postcodes.map(([postcode, name]) => (
                <NearbyLinks key={postcode} postcode={postcode} kind="pet" place={name} />
              ))
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
