import { useQuery } from '@apollo/client';
import { Link, useParams } from 'react-router-dom';
import { ContactBook } from '../components/ContactBook';
import { NearbyLinks } from '../components/NearbyLinks';
import { PageHero } from '../components/photos';
import { FARM_CONTACTS_QUERY } from '../graphql/keeping';
import { canWork } from '../roles';
import type { Contact, FarmRole } from '../types';

interface Data {
  farm: { id: string; name: string; postcode: string; myRole: FarmRole } | null;
  contacts: Contact[];
}

/** v4: a farm's vets, feed merchants and suppliers, and where to find more nearby. */
export function ContactsPage() {
  const { id = '' } = useParams();
  const { data, loading, error } = useQuery<Data>(FARM_CONTACTS_QUERY, {
    variables: { farmId: id },
  });
  if (loading) return <p aria-live="polite">Loading contacts…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  const farm = data?.farm;
  if (!farm) return <h1>Farm not found</h1>;

  return (
    <section>
      <PageHero photo="barn" eyebrow={<Link to={`/farms/${farm.id}`}>{farm.name}</Link>}>
        <div>
          <h1>Contacts and suppliers</h1>
          <p>Your vet, feed merchants and suppliers, one tap from a call.</p>
        </div>
      </PageHero>

      <div className="contacts-layout">
        <ContactBook
          contacts={data.contacts}
          farmId={farm.id}
          canEdit={canWork(farm.myRole)}
          refetch={{ query: FARM_CONTACTS_QUERY, variables: { farmId: farm.id } }}
        />
        <aside className="panel" aria-label="Find nearby">
          <h2>Find nearby</h2>
          <p className="muted">Searches the map around {farm.postcode}. Opens in a new tab.</p>
          <NearbyLinks postcode={farm.postcode} kind="farm" />
        </aside>
      </div>
    </section>
  );
}
