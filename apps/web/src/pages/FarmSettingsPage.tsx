import { useMutation, useQuery } from '@apollo/client';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FieldForm, type FieldFormValues } from '../components/FieldForm';
import { dayMonth } from '../dates';
import { errorMessage } from '../errors';
import {
  DELETE_FARM,
  FARM_QUERY,
  FARMS_QUERY,
  FARM_SETTINGS_QUERY,
  RESTORE_GROUP,
  SET_FIELD_ARCHIVED,
  UPDATE_FARM,
  UPDATE_FIELD,
} from '../graphql/farms';
import { canManage } from '../roles';
import type { Field, FarmRole } from '../types';

interface SettingsField extends Field {
  archivedOn: string | null;
}

interface FarmSettings {
  id: string;
  name: string;
  postcode: string;
  cphNumber: string | null;
  flockMark: string | null;
  myRole: FarmRole;
  fields: SettingsField[];
  archivedFields: SettingsField[];
  archivedGroups: Array<{
    id: string;
    name: string;
    archivedOn: string;
    archiveReason: string;
  }>;
}

const sameName = (a: string, b: string) =>
  a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();

function DetailsForm({
  farm,
  onSave,
}: {
  farm: FarmSettings;
  onSave: (input: {
    name: string;
    postcode: string;
    cphNumber: string;
    flockMark: string;
  }) => Promise<unknown>;
}) {
  const [name, setName] = useState(farm.name);
  const [postcode, setPostcode] = useState(farm.postcode);
  const [cphNumber, setCphNumber] = useState(farm.cphNumber ?? '');
  const [flockMark, setFlockMark] = useState(farm.flockMark ?? '');
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await onSave({
        name: name.trim(),
        postcode: postcode.trim(),
        cphNumber: cphNumber.trim(),
        flockMark: flockMark.trim(),
      });
      setMessage({ error: false, text: 'Saved' });
    } catch (err) {
      setMessage({ error: true, text: errorMessage(err) });
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} aria-label="Farm details">
      <div className="form--inline">
        <label>
          Farm name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Postcode
          <input value={postcode} onChange={(e) => setPostcode(e.target.value)} required />
        </label>
        <label>
          CPH number
          <input
            value={cphNumber}
            onChange={(e) => setCphNumber(e.target.value)}
            placeholder="e.g. 12/345/6789"
          />
        </label>
        <label>
          Flock or herd mark
          <input
            value={flockMark}
            onChange={(e) => setFlockMark(e.target.value)}
            placeholder="e.g. UK 123456"
          />
        </label>
      </div>
      {message && (
        <p className={message.error ? 'error' : 'muted'} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      <button type="submit">Save details</button>
    </form>
  );
}

function DeleteFarmForm({
  farm,
  onDelete,
}: {
  farm: FarmSettings;
  onDelete: () => Promise<unknown>;
}) {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await onDelete();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form className="form danger-zone" onSubmit={handleSubmit} aria-label="Delete farm">
      <p>
        Deleting <strong>{farm.name}</strong> removes its fields, groups, treatment records, checks,
        tasks and briefings for good. Download your treatment records first if you need them.
      </p>
      <label>
        Type the farm name to confirm
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="danger" disabled={!sameName(typed, farm.name)}>
        Delete farm for good
      </button>
    </form>
  );
}

/** Farm details, fields, archived groups and deleting the farm. */
export function FarmSettingsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useQuery<{ farm: FarmSettings | null }>(FARM_SETTINGS_QUERY, {
    variables: { id },
  });
  const refetch = {
    refetchQueries: [
      { query: FARM_SETTINGS_QUERY, variables: { id } },
      { query: FARM_QUERY, variables: { id } },
    ],
  };
  const [updateFarm] = useMutation(UPDATE_FARM, refetch);
  const [updateField] = useMutation(UPDATE_FIELD, refetch);
  const [setFieldArchived] = useMutation(SET_FIELD_ARCHIVED, refetch);
  const [restoreGroup] = useMutation(RESTORE_GROUP, refetch);
  const [deleteFarm] = useMutation(DELETE_FARM, { refetchQueries: [{ query: FARMS_QUERY }] });
  const [editingField, setEditingField] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) return <p aria-live="polite">Loading…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  const farm = data?.farm;
  if (!farm) return <h1>Farm not found</h1>;
  if (!canManage(farm.myRole))
    return (
      <section>
        <p className="muted">
          <Link to={`/farms/${farm.id}`}>{farm.name}</Link>
        </p>
        <h1>Farm settings</h1>
        <p>Only a farm owner can change these settings.</p>
      </section>
    );

  const run = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <section>
      <p className="muted">
        <Link to={`/farms/${farm.id}`}>{farm.name}</Link>
      </p>
      <h1>Farm settings</h1>

      <h2>Details</h2>
      <DetailsForm farm={farm} onSave={(input) => updateFarm({ variables: { id, input } })} />

      <h2>Fields</h2>
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}
      {farm.fields.length === 0 && <p className="muted">No fields.</p>}
      <ul className="list" aria-label="Fields">
        {farm.fields.map((field) => (
          <li key={field.id}>
            {editingField === field.id ? (
              <FieldForm
                initial={field}
                onCancel={() => setEditingField(null)}
                onSubmit={async (values: FieldFormValues) => {
                  await updateField({ variables: { id: field.id, input: values } });
                  setEditingField(null);
                }}
              />
            ) : (
              <div className="row">
                <strong>{field.name}</strong>
                <span className="log__actions">
                  <button
                    type="button"
                    className="link-button"
                    aria-label={`Edit ${field.name}`}
                    onClick={() => setEditingField(field.id)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="link-button"
                    aria-label={`Archive ${field.name}`}
                    onClick={() =>
                      run(() => setFieldArchived({ variables: { id: field.id, archived: true } }))
                    }
                  >
                    Archive
                  </button>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {farm.archivedFields.length > 0 && (
        <details className="quiet">
          <summary>Archived fields ({farm.archivedFields.length})</summary>
          <ul className="list" aria-label="Archived fields">
            {farm.archivedFields.map((field) => (
              <li key={field.id} className="row">
                <span>
                  {field.name}{' '}
                  <span className="muted">
                    archived {field.archivedOn ? dayMonth(field.archivedOn) : ''}
                  </span>
                </span>
                <button
                  type="button"
                  className="link-button"
                  aria-label={`Restore ${field.name}`}
                  onClick={() =>
                    run(() => setFieldArchived({ variables: { id: field.id, archived: false } }))
                  }
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <h2>Archived groups</h2>
      {farm.archivedGroups.length === 0 ? (
        <p className="muted">
          None. Archive a group from its page when it&apos;s sold or finished; its records are kept.
        </p>
      ) : (
        <ul className="list" aria-label="Archived groups">
          {farm.archivedGroups.map((group) => (
            <li key={group.id} className="row">
              <span>
                <Link to={`/groups/${group.id}`}>{group.name}</Link>
                <br />
                <span className="muted">
                  {dayMonth(group.archivedOn)} · {group.archiveReason}
                </span>
              </span>
              <button
                type="button"
                className="link-button"
                aria-label={`Restore ${group.name}`}
                onClick={() => run(() => restoreGroup({ variables: { id: group.id } }))}
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2>Delete farm</h2>
      <DeleteFarmForm
        farm={farm}
        onDelete={async () => {
          await deleteFarm({ variables: { id, confirmName: farm.name } });
          navigate('/farms');
        }}
      />
    </section>
  );
}
