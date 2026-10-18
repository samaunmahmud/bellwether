import { useMutation, type DocumentNode } from '@apollo/client';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../errors';
import { ADD_CAMERA, DELETE_CAMERA, UPDATE_CAMERA } from '../graphql/cameras';
import type { Camera } from '../types';
import { Icon } from './Icon';
import { useToast } from './Toasts';

interface Option {
  id: string;
  name: string;
}

interface CameraValues {
  name: string;
  url: string;
  fieldId: string | null;
  groupId: string | null;
  notes: string | null;
}

/**
 * v4.2: links to the farm's CCTV cameras. Each opens the camera maker's own viewer page in a
 * new tab; Bellwether doesn't stream or store video.
 */
export function CameraLinks({
  farmId,
  cameras,
  fields,
  groups,
  canEdit,
  refetch,
}: {
  farmId: string;
  cameras: Camera[];
  fields: Option[];
  groups: Option[];
  canEdit: boolean;
  refetch: { query: DocumentNode; variables?: Record<string, unknown> };
}) {
  const options = { refetchQueries: [refetch], awaitRefetchQueries: true };
  const [addCamera] = useMutation(ADD_CAMERA, options);
  const [updateCamera] = useMutation(UPDATE_CAMERA, options);
  const [deleteCamera] = useMutation(DELETE_CAMERA, options);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const toast = useToast();

  async function add(values: CameraValues) {
    await addCamera({ variables: { input: { farmId, ...values } } });
    setEditing(null);
    toast(`${values.name} saved`);
  }

  async function update(id: string, values: CameraValues) {
    await updateCamera({ variables: { id, input: values } });
    setEditing(null);
    toast(`${values.name} updated`);
  }

  async function remove(c: Camera) {
    if (!window.confirm(`Remove the link to ${c.name}? The camera itself isn’t affected.`)) return;
    await deleteCamera({ variables: { id: c.id } });
  }

  const form = (initial?: Camera) => (
    <CameraForm
      key={initial?.id ?? 'new'}
      initial={initial}
      fields={fields}
      groups={groups}
      onSubmit={(values) => (initial ? update(initial.id, values) : add(values))}
      onCancel={() => setEditing(null)}
    />
  );

  return (
    <section className="panel camera-links" aria-label="CCTV cameras">
      <div className="panel__head">
        <h2>
          <Icon name="cctv" size={20} /> CCTV cameras
        </h2>
        {canEdit && editing !== 'new' && (
          <button type="button" onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} /> Add a camera
          </button>
        )}
      </div>
      <p className="muted">
        Save the web address of each camera’s viewer page (from your camera app or its maker’s
        website) to open it here with one tap.
      </p>
      {editing === 'new' && form()}
      {cameras.length === 0 && editing !== 'new' ? (
        <p className="empty">No cameras linked yet.</p>
      ) : (
        <div className="camera-grid">
          {cameras.map((c) =>
            editing === c.id ? (
              form(c)
            ) : (
              <article key={c.id} className="camera" aria-labelledby={`camera-${c.id}`}>
                <h3 id={`camera-${c.id}`}>{c.name}</h3>
                {(c.field || c.group) && (
                  <p className="camera__where">
                    {[c.field?.name, c.group?.name].filter(Boolean).join(' · ')}
                  </p>
                )}
                {c.notes && <p className="muted">{c.notes}</p>}
                <a
                  className="button"
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${c.name} viewer (opens in a new tab)`}
                >
                  <Icon name="eye" size={18} /> Open viewer
                </a>
                {canEdit && (
                  <p className="contact__actions">
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setEditing(c.id)}
                      aria-label={`Edit ${c.name}`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => remove(c)}
                      aria-label={`Remove ${c.name}`}
                    >
                      Remove
                    </button>
                  </p>
                )}
              </article>
            ),
          )}
        </div>
      )}
    </section>
  );
}

function CameraForm({
  initial,
  fields,
  groups,
  onSubmit,
  onCancel,
}: {
  initial?: Camera;
  fields: Option[];
  groups: Option[];
  onSubmit: (values: CameraValues) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState({
    name: initial?.name ?? '',
    url: initial?.url ?? '',
    fieldId: initial?.field?.id ?? '',
    groupId: initial?.group?.id ?? '',
    notes: initial?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof values, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  const orNull = (v: string) => (v.trim() ? v.trim() : null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({
        name: values.name.trim(),
        url: values.url.trim(),
        fieldId: orNull(values.fieldId),
        groupId: orNull(values.groupId),
        notes: orNull(values.notes),
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form className="form camera-form" onSubmit={handleSubmit} aria-label="Camera">
      <div className="form--inline">
        <label>
          Name
          <input value={values.name} onChange={(e) => set('name', e.target.value)} required />
        </label>
        <label>
          Viewer web address
          <input
            value={values.url}
            onChange={(e) => set('url', e.target.value)}
            placeholder="e.g. cams.example.com"
            required
          />
        </label>
        <label>
          Field
          <select value={values.fieldId} onChange={(e) => set('fieldId', e.target.value)}>
            <option value="">None</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Group
          <select value={values.groupId} onChange={(e) => set('groupId', e.target.value)}>
            <option value="">None</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Notes
        <input
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="e.g. which app, where the login is kept"
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit">Save camera</button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
