import { useState, type FormEvent } from 'react';
import { errorMessage } from '../errors';

export interface FieldFormValues {
  name: string;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
}

type LocationKind = 'farm' | 'postcode' | 'pin';

/** FR-2.2: a field is located by its own postcode, a map pin, or (by default) the farm postcode. */
export function FieldForm({
  onSubmit,
}: {
  onSubmit: (values: FieldFormValues) => Promise<unknown>;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<LocationKind>('farm');
  const [postcode, setPostcode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (kind === 'pin' && (latitude === '' || longitude === '')) {
      setError('A map pin needs both latitude and longitude');
      return;
    }
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        postcode: kind === 'postcode' ? postcode.trim() : null,
        latitude: kind === 'pin' ? Number(latitude) : null,
        longitude: kind === 'pin' ? Number(longitude) : null,
      });
      setName('');
      setPostcode('');
      setLatitude('');
      setLongitude('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const choice = (value: LocationKind, label: string) => (
    <label className={kind === value ? 'is-active' : undefined}>
      <input
        type="radio"
        name="field-location"
        value={value}
        checked={kind === value}
        onChange={() => setKind(value)}
      />
      {label}
    </label>
  );

  return (
    <form className="form" onSubmit={handleSubmit} aria-label="Add field">
      <label>
        Field name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <fieldset className="segmented">
        <legend>Where is it?</legend>
        {choice('farm', 'The farm postcode')}
        {choice('postcode', 'Its own postcode')}
        {choice('pin', 'A map pin')}
      </fieldset>
      {kind === 'postcode' && (
        <label>
          Postcode
          <input value={postcode} onChange={(e) => setPostcode(e.target.value)} required />
        </label>
      )}
      {kind === 'pin' && (
        <div className="form--inline">
          <label>
            Latitude
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="e.g. 54.12"
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="e.g. -2.54"
            />
          </label>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit">Add field</button>
    </form>
  );
}
