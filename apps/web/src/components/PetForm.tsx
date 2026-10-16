import { useState, type FormEvent } from 'react';

export interface PetFormValues {
  name: string;
  species: string;
  postcode: string | null;
  highExposureHabitat: boolean;
}

export const PET_SPECIES = ['dog', 'cat'];

interface Props {
  onSubmit: (values: PetFormValues) => unknown;
  /** An existing pet to edit. Species can't be changed after adding. */
  initial?: PetFormValues;
  onCancel?: () => void;
}

export function PetForm({ onSubmit, initial, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [species, setSpecies] = useState(initial?.species ?? PET_SPECIES[0]!);
  const [postcode, setPostcode] = useState(initial?.postcode ?? '');
  const [habitat, setHabitat] = useState(initial?.highExposureHabitat ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        species,
        postcode: postcode.trim() || null,
        highExposureHabitat: habitat,
      });
      if (!initial) {
        setName('');
        setPostcode('');
        setHabitat(false);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="form form--inline"
      onSubmit={handleSubmit}
      aria-label={initial ? 'Edit pet' : 'Add pet'}
    >
      <label>
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bella"
          required
        />
      </label>
      {!initial && (
        <label>
          Species
          <select value={species} onChange={(e) => setSpecies(e.target.value)}>
            {PET_SPECIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        Home postcode (for the pet&apos;s forecast)
        <input
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          placeholder="Optional, e.g. UB8 3PH"
          autoComplete="postal-code"
        />
      </label>
      <label className="toggle">
        <input type="checkbox" checked={habitat} onChange={(e) => setHabitat(e.target.checked)} />
        Walks in long grass or woodland
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={saving}>
        {initial ? 'Save pet' : 'Add pet'}
      </button>
      {onCancel && (
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}
