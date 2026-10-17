import { useMutation, useQuery } from '@apollo/client';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useToast } from '../components/Toasts';
import { shortDay, todayIso } from '../dates';
import { errorMessage } from '../errors';
import { ADD_MEDICINE, DELETE_MEDICINE, MEDICINES_QUERY, UPDATE_MEDICINE } from '../graphql/v3';
import { canWork } from '../roles';
import type { FarmRole, MedicineItem, MedicineStatus } from '../types';

export const STATUS_WORD: Record<MedicineStatus, string> = {
  OK: 'In date',
  EXPIRING: 'Expires soon',
  EXPIRED: 'Out of date',
  FINISHED: 'Finished',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** "in 12 days", "today", "3 days ago" */
export function relativeDays(iso: string, today = todayIso()): string {
  const days = Math.round(
    (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS,
  );
  if (days === 0) return 'today';
  if (days > 0) return `in ${days} ${days === 1 ? 'day' : 'days'}`;
  return `${-days} ${days === -1 ? 'day' : 'days'} ago`;
}

function MedicineForm({ onAdd }: { onAdd: (input: Record<string, unknown>) => Promise<unknown> }) {
  const empty = {
    productName: '',
    batchNumber: '',
    quantity: '',
    expiryDate: '',
    supplier: '',
    meat: '',
    milk: '',
  };
  const [v, setV] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) =>
    setV((old) => ({ ...old, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onAdd({
        productName: v.productName,
        batchNumber: v.batchNumber || null,
        quantity: v.quantity || null,
        expiryDate: v.expiryDate || null,
        supplier: v.supplier || null,
        purchasedOn: todayIso(),
        meatWithdrawalDays: v.meat === '' ? null : Number(v.meat),
        milkWithdrawalDays: v.milk === '' ? null : Number(v.milk),
      });
      setV(empty);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form className="form" aria-label="Add a medicine" onSubmit={submit}>
      <div className="form--inline">
        <label>
          Product name (from the label)
          <input value={v.productName} onChange={set('productName')} required />
        </label>
        <label>
          Batch number
          <input value={v.batchNumber} onChange={set('batchNumber')} />
        </label>
        <label>
          Quantity
          <input value={v.quantity} onChange={set('quantity')} placeholder="e.g. 2 × 500 ml" />
        </label>
        <label>
          Expiry date
          <input type="date" value={v.expiryDate} onChange={set('expiryDate')} />
        </label>
        <label>
          Supplier
          <input value={v.supplier} onChange={set('supplier')} />
        </label>
        <label>
          Meat withdrawal (days, from label)
          <input type="number" inputMode="numeric" min={0} value={v.meat} onChange={set('meat')} />
        </label>
        <label>
          Milk withdrawal (days, from label)
          <input type="number" inputMode="numeric" min={0} value={v.milk} onChange={set('milk')} />
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit">Add to cabinet</button>
      </div>
    </form>
  );
}

/** v3: what's in the medicine cabinet, what's running out of date, and what's finished. */
export function MedicinesPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const [showFinished, setShowFinished] = useState(false);
  const [adding, setAdding] = useState(false);
  const { data, loading, error } = useQuery<{
    farm: { id: string; name: string; myRole: FarmRole } | null;
    medicines: MedicineItem[];
  }>(MEDICINES_QUERY, { variables: { farmId: id } });
  const refetch = { refetchQueries: [{ query: MEDICINES_QUERY, variables: { farmId: id } }] };
  const [add] = useMutation(ADD_MEDICINE, refetch);
  const [update] = useMutation(UPDATE_MEDICINE, refetch);
  const [remove] = useMutation(DELETE_MEDICINE, refetch);

  if (loading) return <p aria-live="polite">Loading the medicine cabinet…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  if (!data?.farm) return <h1>Farm not found</h1>;
  const { farm, medicines } = data;
  const worker = canWork(farm.myRole);
  const inStock = medicines.filter((m) => m.status !== 'FINISHED');
  const finished = medicines.filter((m) => m.status === 'FINISHED');
  const expired = inStock.filter((m) => m.status === 'EXPIRED').length;
  const expiring = inStock.filter((m) => m.status === 'EXPIRING').length;
  const shown = showFinished ? finished : inStock;

  return (
    <section>
      <p className="muted">
        <Link to={`/farms/${farm.id}`}>{farm.name}</Link>
      </p>
      <header className="page-title">
        <div>
          <h1>Medicine cabinet</h1>
          <p className="lead">
            {inStock.length} in stock
            {expired > 0 && ` · ${expired} out of date`}
            {expiring > 0 && ` · ${expiring} expiring within 30 days`}
          </p>
        </div>
        {worker && !adding && (
          <button type="button" onClick={() => setAdding(true)}>
            Add a medicine
          </button>
        )}
      </header>

      {worker && adding && (
        <section className="panel" aria-labelledby="add-heading">
          <div className="panel__head">
            <h2 id="add-heading">Add a medicine</h2>
            <button type="button" className="link-button" onClick={() => setAdding(false)}>
              Close
            </button>
          </div>
          <MedicineForm
            onAdd={async (input) => {
              await add({ variables: { farmId: farm.id, input } });
              toast(`${String(input.productName)} added to the cabinet`);
            }}
          />
          <p className="muted">
            Type the product and withdrawal periods exactly as on the label or your vet’s
            instructions. Bellwether never suggests medicines or doses.
          </p>
        </section>
      )}

      <label className="toggle">
        <input
          type="checkbox"
          checked={showFinished}
          onChange={(e) => setShowFinished(e.target.checked)}
        />
        Show finished ({finished.length})
      </label>

      {shown.length === 0 ? (
        <p className="empty">
          {showFinished
            ? 'Nothing finished yet.'
            : 'The cabinet is empty. Add what you have in stock.'}
        </p>
      ) : (
        <ul className="medicine-grid">
          {shown.map((m) => (
            <li key={m.id} className={`medicine medicine--${m.status.toLowerCase()}`}>
              <div className="medicine__head">
                <h3>{m.productName}</h3>
                <span className={`status status--${m.status.toLowerCase()}`}>
                  {STATUS_WORD[m.status]}
                </span>
              </div>
              <dl className="medicine__facts">
                {m.expiryDate && (
                  <>
                    <dt>Expiry</dt>
                    <dd>
                      {shortDay(m.expiryDate)} ({relativeDays(m.expiryDate)})
                    </dd>
                  </>
                )}
                {m.batchNumber && (
                  <>
                    <dt>Batch</dt>
                    <dd>{m.batchNumber}</dd>
                  </>
                )}
                {m.quantity && (
                  <>
                    <dt>Quantity</dt>
                    <dd>{m.quantity}</dd>
                  </>
                )}
                {(m.meatWithdrawalDays !== null || m.milkWithdrawalDays !== null) && (
                  <>
                    <dt>Withdrawal</dt>
                    <dd>
                      {m.meatWithdrawalDays !== null && `Meat ${m.meatWithdrawalDays} days`}
                      {m.meatWithdrawalDays !== null && m.milkWithdrawalDays !== null && ' · '}
                      {m.milkWithdrawalDays !== null && `Milk ${m.milkWithdrawalDays} days`}
                    </dd>
                  </>
                )}
                {m.supplier && (
                  <>
                    <dt>Supplier</dt>
                    <dd>{m.supplier}</dd>
                  </>
                )}
                {m.finishedOn && (
                  <>
                    <dt>Finished</dt>
                    <dd>{shortDay(m.finishedOn)}</dd>
                  </>
                )}
              </dl>
              {worker && (
                <div className="medicine__actions">
                  {m.status !== 'FINISHED' ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={async () => {
                        await update({
                          variables: { id: m.id, input: { finishedOn: todayIso() } },
                        });
                        toast(`${m.productName} marked as finished`);
                      }}
                    >
                      Mark finished
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        update({ variables: { id: m.id, input: { finishedOn: null } } })
                      }
                    >
                      Back in stock
                    </button>
                  )}
                  <button
                    type="button"
                    className="link-button"
                    aria-label={`Remove ${m.productName}`}
                    onClick={async () => {
                      if (!window.confirm(`Remove ${m.productName} from the cabinet?`)) return;
                      await remove({ variables: { id: m.id } });
                      toast(`${m.productName} removed`);
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
