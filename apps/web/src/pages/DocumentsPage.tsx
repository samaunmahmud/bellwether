import { useQuery } from '@apollo/client';
import { Link, useParams } from 'react-router-dom';
import { DocumentLibrary } from '../components/DocumentLibrary';
import { PageHero } from '../components/photos';
import { FARM_DOCUMENTS_QUERY } from '../graphql/documents';
import { canWork } from '../roles';
import type { FarmRole, StoredDocument } from '../types';

interface Data {
  farm: {
    id: string;
    name: string;
    myRole: FarmRole;
    groups: Array<{ id: string; name: string }>;
  } | null;
  taggedAnimals: Array<{ id: string; tag: string; status: string }>;
  documents: StoredDocument[];
}

/** v4: a farm's documents, shared with its members. */
export function DocumentsPage() {
  const { id = '' } = useParams();
  const { data, loading, error } = useQuery<Data>(FARM_DOCUMENTS_QUERY, {
    variables: { farmId: id },
  });
  if (loading) return <p aria-live="polite">Loading documents…</p>;
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
          <h1>Documents</h1>
          <p>Vet reports, certificates, movement licences and receipts, shared with the farm.</p>
        </div>
      </PageHero>
      <DocumentLibrary
        documents={data.documents}
        scope={{ farmId: farm.id }}
        canEdit={canWork(farm.myRole)}
        refetch={{ query: FARM_DOCUMENTS_QUERY, variables: { farmId: farm.id } }}
        groups={farm.groups.map((g) => ({ id: g.id, label: g.name }))}
        animals={data.taggedAnimals
          .filter((a) => a.status === 'ON_FARM')
          .map((a) => ({ id: a.id, label: a.tag }))}
      />
    </section>
  );
}
