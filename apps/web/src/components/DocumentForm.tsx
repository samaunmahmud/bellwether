import { useState, type FormEvent } from 'react';
import { ACCEPTED_FILES, MAX_UPLOAD_BYTES, readAsDataUrl } from '../documents';
import { errorMessage } from '../errors';
import type { DocumentKind, StoredDocument } from '../types';

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  HEALTH: 'Health',
  CERTIFICATE: 'Certificate',
  MOVEMENT: 'Movement',
  INSURANCE: 'Insurance',
  RECEIPT: 'Receipt',
  PHOTO: 'Photo',
  OTHER: 'Other',
};

const KIND_HINTS: Record<DocumentKind, string> = {
  HEALTH: 'Health (vet report, test result)',
  CERTIFICATE: 'Certificate (passport, vaccination)',
  MOVEMENT: 'Movement (licence or record)',
  INSURANCE: 'Insurance',
  RECEIPT: 'Receipt or invoice',
  PHOTO: 'Photo',
  OTHER: 'Other',
};

/** The details that can change after upload. Empty boxes are sent as null. */
export interface DocumentDetails {
  kind: DocumentKind;
  title: string | null;
  documentDate: string | null;
  expiresOn: string | null;
  notes: string | null;
}

export interface NewDocumentValues extends DocumentDetails {
  groupId: string | null;
  taggedAnimalId: string | null;
  fileName: string;
  contentBase64: string;
}

interface Option {
  id: string;
  label: string;
}

/**
 * v4: upload a document (with `onUpload`) or change one's details (with `initial` and
 * `onSave`). Groups and animals to link are offered only on a farm.
 */
export function DocumentForm({
  initial,
  groups = [],
  animals = [],
  onUpload,
  onSave,
  onCancel,
}: {
  initial?: StoredDocument;
  groups?: Option[];
  animals?: Option[];
  onUpload?: (values: NewDocumentValues) => Promise<unknown>;
  onSave?: (values: DocumentDetails) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState({
    kind: initial?.kind ?? 'OTHER',
    title: initial?.title ?? '',
    documentDate: initial?.documentDate ?? '',
    expiresOn: initial?.expiresOn ?? '',
    notes: initial?.notes ?? '',
    groupId: '',
    taggedAnimalId: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof values, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  const orNull = (v: string) => (v.trim() ? v.trim() : null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const details: DocumentDetails = {
      kind: values.kind as DocumentKind,
      title: orNull(values.title),
      documentDate: orNull(values.documentDate),
      expiresOn: orNull(values.expiresOn),
      notes: orNull(values.notes),
    };
    try {
      setSaving(true);
      if (onSave) await onSave(details);
      else {
        if (!file) throw new Error('Choose a file to upload');
        if (file.size > MAX_UPLOAD_BYTES) throw new Error('Files can be up to 5 MB');
        await onUpload?.({
          ...details,
          groupId: orNull(values.groupId),
          taggedAnimalId: orNull(values.taggedAnimalId),
          fileName: file.name,
          contentBase64: await readAsDataUrl(file),
        });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const uploading = !initial;
  return (
    <form
      className="form panel document-form"
      onSubmit={handleSubmit}
      aria-label={uploading ? 'Upload a document' : `Edit ${initial.title}`}
    >
      {uploading && (
        <label className="document-form__file">
          File (PDF or photo, up to 5 MB)
          <input
            type="file"
            accept={ACCEPTED_FILES}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
      <div className="form--inline">
        <label>
          Kind
          <select value={values.kind} onChange={(e) => set('kind', e.target.value)}>
            {Object.entries(KIND_HINTS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Title
          <input
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder={uploading ? 'Optional' : undefined}
            required={!uploading}
          />
        </label>
        <label>
          Dated
          <input
            type="date"
            value={values.documentDate}
            onChange={(e) => set('documentDate', e.target.value)}
          />
        </label>
        <label>
          Expires on
          <input
            type="date"
            value={values.expiresOn}
            onChange={(e) => set('expiresOn', e.target.value)}
          />
        </label>
        {uploading && groups.length > 0 && (
          <label>
            Group
            <select value={values.groupId} onChange={(e) => set('groupId', e.target.value)}>
              <option value="">Whole farm</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {uploading && animals.length > 0 && (
          <label>
            Animal
            <select
              value={values.taggedAnimalId}
              onChange={(e) => set('taggedAnimalId', e.target.value)}
            >
              <option value="">None</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label>
        Notes
        <input
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="e.g. reference number, who issued it"
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save document'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
