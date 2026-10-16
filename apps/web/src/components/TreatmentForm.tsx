import { useState, type FormEvent } from 'react';
import { todayIso } from '../dates';
import { errorMessage } from '../errors';

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

/**
 * FR-6.1: record a treatment. Every field is typed in by the farmer; Bellwether never
 * suggests products, doses or withdrawal periods (FR-6.3).
 */
export function TreatmentForm({
  headCount,
  onSubmit,
}: {
  headCount: number;
  onSubmit: (values: TreatmentFormValues) => Promise<unknown>;
}) {
  const [date, setDate] = useState(todayIso());
  const [productName, setProductName] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantityUsed, setQuantityUsed] = useState('');
  const [animalsTreated, setAnimalsTreated] = useState('');
  const [administeredBy, setAdministeredBy] = useState('');
  const [reason, setReason] = useState('');
  const [meatDays, setMeatDays] = useState('');
  const [milkDays, setMilkDays] = useState('');
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
      await onSubmit({
        date,
        productName: productName.trim(),
        batchNumber: orNull(batchNumber),
        quantityUsed: orNull(quantityUsed),
        animalsTreated: count,
        administeredBy: administeredBy.trim(),
        reason: orNull(reason),
        meatWithdrawalDays: Number(meatDays),
        milkWithdrawalDays: milkDays === '' ? null : Number(milkDays),
      });
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
    <form className="form" onSubmit={handleSubmit} aria-label="Record treatment">
      <p className="notice" role="note">
        Withdrawal periods must come from the product label or your vet.
      </p>
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
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit">Record treatment</button>
    </form>
  );
}
