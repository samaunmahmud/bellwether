import type { TreatmentRow } from './types';

type Cell = string | number | null;

// A cell starting with one of these could run as a formula when opened in a spreadsheet.
const FORMULA_START = /^[=+\-@]/;

function cell(value: Cell): string {
  if (value === null) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180-style CSV: CRLF line endings, quotes only where needed. */
export function toCsv(rows: Cell[][]): string {
  return rows.map((row) => row.map(cell).join(',') + '\r\n').join('');
}

/** FR-6.4: treatment records for an audit, one row per treatment. Voided ones stay, marked (FR-6.5). */
export function treatmentsCsv(treatments: TreatmentRow[]): string {
  return toCsv([
    [
      'Date',
      'Group',
      'Product',
      'Batch',
      'Quantity used',
      'Animals treated',
      'Administered by',
      'Reason',
      'Meat withdrawal (days)',
      'Meat withdrawal ends',
      'Milk withdrawal (days)',
      'Milk withdrawal ends',
      'Status',
    ],
    ...treatments.map((t) => [
      t.date,
      t.group.name,
      t.productName,
      t.batchNumber,
      t.quantityUsed,
      t.animalsTreated,
      t.administeredBy,
      t.reason,
      t.meatWithdrawalDays,
      t.meatWithdrawalEnds,
      t.milkWithdrawalDays,
      t.milkWithdrawalEnds,
      t.voided ? `Voided: ${t.voidReason ?? ''}` : null,
    ]),
  ]);
}
