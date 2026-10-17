import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { ContactCard } from '../components/ContactCard';
import { Disclaimer } from '../components/Disclaimer';
import { Icon } from '../components/Icon';
import { FIND_A_VET_URL, nearbySearches } from '../nearby';
import { EMERGENCY_QUERY } from '../graphql/keeping';
import type { Contact } from '../types';

interface Data {
  emergencyContacts: Contact[];
  farms: Array<{ id: string; name: string; postcode: string }>;
  animals: Array<{ id: string; name: string; postcode: string | null }>;
}

/**
 * v4: who to call when an animal needs help now. Every vet saved on any of your farms or in your
 * own contacts, out-of-hours lines first, then ways to find one. Bellwether gives no treatment
 * advice: the answer is always to call a vet.
 */
export function EmergencyPage() {
  const { data, loading, error } = useQuery<Data>(EMERGENCY_QUERY, {
    fetchPolicy: 'cache-and-network',
  });
  const places = [
    ...(data?.farms ?? []).map((f) => ({ key: f.id, name: f.name, postcode: f.postcode })),
    ...(data?.animals ?? [])
      .filter((a) => a.postcode)
      .map((a) => ({ key: a.id, name: a.name, postcode: a.postcode! })),
  ];

  return (
    <section className="emergency">
      <header className="emergency__hero">
        <span className="emergency__icon" aria-hidden="true">
          <Icon name="siren" size={34} />
        </span>
        <div>
          <h1>Emergency</h1>
          <p>
            If an animal is injured, collapsed, struggling to give birth or in pain, call your vet
            now. Out-of-hours lines are listed first.
          </p>
        </div>
      </header>

      {loading && !data && <p aria-live="polite">Loading your vets…</p>}
      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}

      {data && data.emergencyContacts.length === 0 && (
        <p className="empty">
          No vet saved yet. Add your vet and their out-of-hours number under a farm’s{' '}
          <strong>Contacts</strong> or in <Link to="/contacts">My contacts</Link>, so they’re here
          when you need them.
        </p>
      )}
      {data && data.emergencyContacts.length > 0 && (
        <div className="contact-grid contact-grid--emergency">
          {data.emergencyContacts.map((c) => (
            <ContactCard key={c.id} contact={c} showFarm />
          ))}
        </div>
      )}

      <section className="panel" aria-labelledby="find-vet">
        <h2 id="find-vet">Find a vet</h2>
        <p>
          <a href={FIND_A_VET_URL} target="_blank" rel="noopener noreferrer" className="button">
            <Icon name="search" size={18} /> Find a vet on the RCVS register
          </a>
        </p>
        {places.length > 0 && (
          <ul className="nearby">
            {places.map((p) => (
              <li key={p.key}>
                <a
                  href={nearbySearches(p.postcode, 'farm')[0]!.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="pin" size={18} />
                  <span>
                    Vets near {p.name} ({p.postcode})
                  </span>
                  <Icon name="arrow" size={16} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Disclaimer />
    </section>
  );
}
