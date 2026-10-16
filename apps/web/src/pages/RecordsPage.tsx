import { useQuery } from '@apollo/client';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { treatmentsCsv } from '../csv';
import { todayIso } from '../dates';
import { TREATMENTS_QUERY } from '../graphql/records';
import type { TreatmentRow } from '../types';

/** FR-6.4: a farm's treatment records for a date range, as a printable table and a CSV file. */
export function RecordsPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const to = params.get('to') ?? todayIso();
  const from = params.get('from') ?? `${to.slice(0, 4)}-01-01`;

  const { data, loading, error } = useQuery<{ treatments: TreatmentRow[] }>(TREATMENTS_QUERY, {
    variables: { farmId: id, from, to },
  });
  const rows = data?.treatments ?? [];
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(treatmentsCsv(rows))}`;

  const setRange = (key: 'from' | 'to', value: string) => {
    if (value) setParams({ from, to, [key]: value }, { replace: true });
  };

  return (
    <section className="printable">
      <p className="muted no-print">
        <Link to={`/farms/${id}`}>Back to farm</Link>
      </p>
      <h1>Treatment records</h1>
      <p className="muted print-only">
        {from} to {to}
      </p>

      <form className="form form--inline no-print" aria-label="Date range">
        <label>
          From
          <input type="date" value={from} onChange={(e) => setRange('from', e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setRange('to', e.target.value)} />
        </label>
      </form>

      {loading && <p aria-live="polite">Loading records…</p>}
      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}
      {data && rows.length === 0 && <p className="muted">No treatments recorded in this period.</p>}

      {rows.length > 0 && (
        <>
          <div className="actions no-print">
            <a className="button" href={csvHref} download={`treatments-${from}-to-${to}.csv`}>
              Download CSV
            </a>
            <button type="button" onClick={() => window.print()}>
              Print
            </button>
          </div>
          <div className="table-scroll">
            <table className="records" aria-label="Treatment records">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Group</th>
                  <th>Product</th>
                  <th>Batch</th>
                  <th>Quantity</th>
                  <th>Animals</th>
                  <th>Given by</th>
                  <th>Reason</th>
                  <th>Meat withdrawal ends</th>
                  <th>Milk withdrawal ends</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className={t.voided ? 'records__voided' : undefined}>
                    <td>{t.date}</td>
                    <td>{t.group.name}</td>
                    <td>{t.productName}</td>
                    <td>{t.batchNumber}</td>
                    <td>{t.quantityUsed}</td>
                    <td>{t.animalsTreated}</td>
                    <td>{t.administeredBy}</td>
                    <td>{t.reason}</td>
                    <td>
                      {t.meatWithdrawalEnds} ({t.meatWithdrawalDays} d)
                    </td>
                    <td>
                      {t.milkWithdrawalEnds
                        ? `${t.milkWithdrawalEnds} (${t.milkWithdrawalDays} d)`
                        : ''}
                    </td>
                    <td>{t.voided ? `Voided: ${t.voidReason ?? ''}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
