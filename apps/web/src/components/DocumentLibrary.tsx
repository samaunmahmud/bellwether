import { useApolloClient, useMutation, type DocumentNode } from '@apollo/client';
import { useState } from 'react';
import { base64ToBlob, EXPIRY_WARNING_DAYS, expiryLabel, handOver } from '../documents';
import { errorMessage } from '../errors';
import {
  ADD_DOCUMENT,
  DELETE_DOCUMENT,
  DOCUMENT_FILE,
  UPDATE_DOCUMENT,
} from '../graphql/documents';
import type { DocumentKind, StoredDocument } from '../types';
import { DocumentCard } from './DocumentCard';
import {
  DOCUMENT_KIND_LABELS,
  DocumentForm,
  type DocumentDetails,
  type NewDocumentValues,
} from './DocumentForm';
import { Icon } from './Icon';
import { useToast } from './Toasts';

interface FileData {
  documentFile: { fileName: string; mimeType: string; contentBase64: string };
}

/** Everything a search can match: title, file name, notes, kind, group and tag. */
const haystack = (d: StoredDocument) =>
  [d.title, d.fileName, d.notes, DOCUMENT_KIND_LABELS[d.kind], d.group?.name, d.taggedAnimal?.tag]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

/**
 * v4: a farm's or a pet's documents: search, a kind filter, what's expiring, and upload, open,
 * save, edit and delete for those allowed.
 */
export function DocumentLibrary({
  documents,
  scope,
  canEdit,
  refetch,
  groups,
  animals,
}: {
  documents: StoredDocument[];
  scope: { farmId: string } | { petId: string };
  canEdit: boolean;
  refetch: { query: DocumentNode; variables?: Record<string, unknown> };
  groups?: Array<{ id: string; label: string }>;
  animals?: Array<{ id: string; label: string }>;
}) {
  const client = useApolloClient();
  const options = { refetchQueries: [refetch], awaitRefetchQueries: true };
  const [addDocument] = useMutation(ADD_DOCUMENT, options);
  const [updateDocument] = useMutation(UPDATE_DOCUMENT, options);
  const [deleteDocument] = useMutation(DELETE_DOCUMENT, options);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<DocumentKind | 'ALL'>('ALL');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const expiring = documents
    .filter((d) => d.daysToExpiry !== null && d.daysToExpiry <= EXPIRY_WARNING_DAYS)
    .sort((a, b) => a.daysToExpiry! - b.daysToExpiry!);
  const words = search.trim().toLowerCase();
  const shown = documents.filter(
    (d) => (kind === 'ALL' || d.kind === kind) && (!words || haystack(d).includes(words)),
  );

  async function upload(values: NewDocumentValues) {
    const farmOnly =
      'farmId' in scope
        ? { groupId: values.groupId, taggedAnimalId: values.taggedAnimalId }
        : { groupId: null, taggedAnimalId: null };
    await addDocument({
      variables: {
        input: {
          farmId: null,
          petId: null,
          ...scope,
          ...farmOnly,
          kind: values.kind,
          title: values.title,
          fileName: values.fileName,
          contentBase64: values.contentBase64,
          documentDate: values.documentDate,
          expiresOn: values.expiresOn,
          notes: values.notes,
        },
      },
    });
    setEditing(null);
    toast(`${values.title ?? values.fileName} uploaded`);
  }

  async function save(id: string, values: DocumentDetails) {
    await updateDocument({ variables: { id, input: values } });
    setEditing(null);
    toast('Document updated');
  }

  async function remove(d: StoredDocument) {
    if (!window.confirm(`Delete ${d.title}? The file can't be got back.`)) return;
    await deleteDocument({ variables: { id: d.id } });
  }

  async function fetchFile(d: StoredDocument, mode: 'open' | 'save') {
    setError(null);
    setBusy(d.id);
    try {
      const { data } = await client.query<FileData>({
        query: DOCUMENT_FILE,
        variables: { id: d.id },
        // Files are fetched fresh each time and never kept in Apollo's cache.
        fetchPolicy: 'no-cache',
      });
      const file = data.documentFile;
      handOver(base64ToBlob(file.contentBase64, file.mimeType), file.fileName, mode);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="document-library">
      {expiring.length > 0 && (
        <section className="panel doc-expiring" aria-label="Expiring soon">
          <h2>
            <Icon name="alert" size={18} /> Expiring soon
          </h2>
          <ul>
            {expiring.map((d) => {
              const label = expiryLabel(d.daysToExpiry, d.expiresOn)!;
              return (
                <li key={d.id}>
                  <strong>{d.title}</strong>{' '}
                  <span className={`badge badge--${label.level}`}>{label.text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="toolbar document-library__toolbar">
        <label>
          Search documents
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. TB test or UK 1"
          />
        </label>
        <label>
          Show
          <select value={kind} onChange={(e) => setKind(e.target.value as DocumentKind | 'ALL')}>
            <option value="ALL">All kinds</option>
            {Object.entries(DOCUMENT_KIND_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {canEdit && editing !== 'new' && (
          <button type="button" onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} /> Upload a document
          </button>
        )}
      </div>

      {editing === 'new' && (
        <DocumentForm
          groups={groups}
          animals={animals}
          onUpload={upload}
          onCancel={() => setEditing(null)}
        />
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {documents.length === 0 ? (
        <p className="empty">
          No documents yet. Keep vet reports, certificates, passports, movement licences and
          receipts here, so they’re to hand when someone asks.
        </p>
      ) : shown.length === 0 ? (
        <p className="empty">No documents match.</p>
      ) : (
        <div className="doc-grid">
          {shown.map((d) =>
            editing === d.id ? (
              <DocumentForm
                key={d.id}
                initial={d}
                onSave={(values) => save(d.id, values)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <DocumentCard
                key={d.id}
                doc={d}
                busy={busy === d.id}
                onOpen={() => fetchFile(d, 'open')}
                onSave={() => fetchFile(d, 'save')}
                onEdit={canEdit ? () => setEditing(d.id) : undefined}
                onDelete={canEdit ? () => remove(d) : undefined}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
