import { useState, type FormEvent } from 'react';
import { errorMessage } from '../errors';
import type { Contact, ContactKind } from '../types';

export const KIND_LABELS: Record<ContactKind, string> = {
  VET: 'Vet',
  FEED: 'Feed merchant',
  SUPPLIER: 'Supplier',
  OTHER: 'Other',
};

export interface ContactValues {
  kind: ContactKind;
  name: string;
  phone: string | null;
  emergencyPhone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
}

const FIELDS = [
  ['phone', 'Phone', 'tel'],
  ['emergencyPhone', 'Out-of-hours phone', 'tel'],
  ['email', 'Email', 'email'],
  ['website', 'Website', 'text'],
  ['address', 'Address', 'text'],
] as const;

/** v4: add or change a contact. Empty boxes are sent as null. */
export function ContactForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Contact;
  onSubmit: (values: ContactValues) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({
    kind: initial?.kind ?? 'VET',
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    emergencyPhone: initial?.emergencyPhone ?? '',
    email: initial?.email ?? '',
    website: initial?.website ?? '',
    address: initial?.address ?? '',
    notes: initial?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const orNull = (v: string | undefined) => (v?.trim() ? v.trim() : null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({
        kind: values.kind as ContactKind,
        name: values.name!.trim(),
        phone: orNull(values.phone),
        emergencyPhone: orNull(values.emergencyPhone),
        email: orNull(values.email),
        website: orNull(values.website),
        address: orNull(values.address),
        notes: orNull(values.notes),
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form className="form panel contact-form" onSubmit={handleSubmit} aria-label="Contact">
      <div className="form--inline">
        <label>
          Kind
          <select value={values.kind} onChange={(e) => set('kind', e.target.value)}>
            {Object.entries(KIND_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Name
          <input value={values.name} onChange={(e) => set('name', e.target.value)} required />
        </label>
        {FIELDS.map(([key, label, type]) => (
          <label key={key}>
            {label}
            <input
              type={type}
              value={values[key]}
              onChange={(e) => set(key, e.target.value)}
              placeholder={key === 'website' ? 'e.g. example.com' : 'Optional'}
            />
          </label>
        ))}
      </div>
      <label>
        Notes
        <input
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="e.g. delivery days, account number"
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit">Save contact</button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
