import { useState, type FormEvent } from 'react';
import { todayIso } from '../dates';
import { errorMessage } from '../errors';
import type { MedicineItem } from '../types';

export interface TreatmentFormValues {
  date: string;
  productName: string;
  batchNumber: string | null;
  quantityUsed: string | null;
  animalsTreated: number;
  administeredBy: string;
  reason: string | null;
  meatWithdrawalDays: number;
  milkWithdrawalDays: number | null;
}

const orNull = (value: string) => value.trim() || null;

const text = (value: string | number | null | undefined) => (value == null ? '' : String(value));

/**
 * FR-6.1: record a treatment. Every field is typed in by the farmer; Bellwether never
 * suggests products, doses or withdrawal periods (FR-6.3).
 * With `initial`, it corrects an existing record and asks why (FR-6.5).
 */
export function TreatmentForm({
  headCount,
  onSubmit,
  initial,
  onCancel,
  medicines = [],
}: {
  /** v3: in-stock products from the cabinet, to fill in the product fields */
  medicines?: MedicineItem[];
  headCount: number;
  onSubmit: (values: TreatmentFormValues, changeReason?: string) => Promise<unknown>;
  initial?: TreatmentFormValues;
  onCancel?: () => void;
}) {
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [productName, setProductName] = useState(text(initial?.productName));
  const [batchNumber, setBatchNumber] = useState(text(initial?.batchNumber));
  const [quantityUsed, setQuantityUsed] = useState(text(initial?.quantityUsed));
  const [animalsTreated, setAnimalsTreated] = useState(text(initial?.animalsTreated));
  const [administeredBy, setAdministeredBy] = useState(text(initial?.administeredBy));
  const [reason, setReason] = useState(text(initial?.reason));
  const [meatDays, setMeatDays] = useState(text(initial?.meatWithdrawalDays));
  const [milkDays, setMilkDays] = useState(text(initial?.milkWithdrawalDays));
  const [changeReason, setChangeReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const count = Number(animalsTreated);
    if (!Number.isInteger(count) || count < 1 || count > headCount) {
      setError(`Animals treated must be from 1 to ${headCount}`);
      return;
    }
    setError(null);
    try {
      const values = {
        date,
        productName: productName.trim(),
        batchNumber: orNull(batchNumber),
        quantityUsed: orNull(quantityUsed),
        animalsTreated: count,
        administeredBy: administeredBy.trim(),
        reason: orNull(reason),
        meatWithdrawalDays: Number(meatDays),
        milkWithdrawalDays: milkDays === '' ? null : Number(milkDays),
      };
      if (initial) {
        await onSubmit(values, changeReason.trim());
        return;
      }
      await onSubmit(values);
      setProductName('');
      setBatchNumber('');
      setQuantityUsed('');
      setAnimalsTreated('');
      setReason('');
      setMeatDays('');
      setMilkDays('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form
      className="form"
      onSubmit={handleSubmit}
      aria-label={initial ? 'Correct treatment' : 'Record treatment'}
    >
      <p className="notice" role="note">
        Withdrawal periods must come from the product label or your vet.
      </p>
      {!initial && medicines.length > 0 && (
        <label>
          Fill in from the medicine cabinet
          <select
            value=""
            onChange={(e) => {
              const item = medicines.find((m) => m.id === e.target.value);
              if (!item) return;
              setProductName(item.productName);
              setBatchNumber(text(item.batchNumber));
              setMeatDays(text(item.meatWithdrawalDays));
              setMilkDays(text(item.milkWithdrawalDays));
            }}
          >
            <option value="">Choose a product…</option>
            {medicines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.productName}
                {m.batchNumber ? ` (batch ${m.batchNumber})` : ''}
                {m.status === 'EXPIRED' ? ' – out of date' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="form--inline">
        <label>
          Date given
          <input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label>
          Product name
          <input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <label>
          Batch number
          <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
        </label>
        <label>
          Quantity used
          <input
            value={quantityUsed}
            onChange={(e) => setQuantityUsed(e.target.value)}
            placeholder="As written on your records"
          />
        </label>
        <label>
          Animals treated
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={animalsTreated}
            onChange={(e) => setAnimalsTreated(e.target.value)}
            required
          />
        </label>
        <label>
          Administered by
          <input
            value={administeredBy}
            onChange={(e) => setAdministeredBy(e.target.value)}
            required
          />
        </label>
        <label>
          Reason
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <label>
          Meat withdrawal (days)
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={meatDays}
            onChange={(e) => setMeatDays(e.target.value)}
            required
          />
        </label>
        <label>
          Milk withdrawal (days)
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={milkDays}
            onChange={(e) => setMilkDays(e.target.value)}
            placeholder="If it applies"
          />
        </label>
      </div>
      {initial && (
        <label>
          Why are you correcting this?
          <input
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder="Kept in the record's history"
            required
          />
        </label>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit">{initial ? 'Save correction' : 'Record treatment'}</button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
