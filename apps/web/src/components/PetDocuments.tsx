import { useQuery } from '@apollo/client';
import { PET_DOCUMENTS_QUERY } from '../graphql/documents';
import type { StoredDocument } from '../types';
import { DocumentLibrary } from './DocumentLibrary';

/** v4: a pet's documents (insurance, vaccination certificates, passport), private to its owner. */
export function PetDocuments({ petId }: { petId: string }) {
  const { data, loading, error } = useQuery<{ documents: StoredDocument[] }>(PET_DOCUMENTS_QUERY, {
    variables: { petId },
  });
  if (loading) return <p aria-live="polite">Loading documents…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  return (
    <DocumentLibrary
      documents={data?.documents ?? []}
      scope={{ petId }}
      canEdit
      refetch={{ query: PET_DOCUMENTS_QUERY, variables: { petId } }}
    />
  );
}
