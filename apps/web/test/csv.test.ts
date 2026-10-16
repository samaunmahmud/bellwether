import { toCsv, treatmentsCsv } from '../src/csv';
import type { TreatmentRow } from '../src/types';

describe('toCsv', () => {
  it('joins rows with CRLF and quotes only when needed', () => {
    expect(
      toCsv([
        ['a', 'b'],
        ['1', '2'],
      ]),
    ).toBe('a,b\r\n1,2\r\n');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(toCsv([['x,y', 'say "hi"', 'two\nlines']])).toBe('"x,y","say ""hi""","two\nlines"\r\n');
  });

  it('defuses spreadsheet formulas in typed-in text', () => {
    expect(toCsv([['=SUM(A1)', '+1', '-2', '@cmd', 'plain']])).toBe(
      "'=SUM(A1),'+1,'-2,'@cmd,plain\r\n",
    );
  });

  it('writes empty cells for null', () => {
    expect(toCsv([['a', null, 'c']])).toBe('a,,c\r\n');
  });
});

describe('treatmentsCsv (FR-6.4)', () => {
  const row: TreatmentRow = {
    id: 't1',
    date: '2026-06-01',
    productName: 'Product, from label',
    batchNumber: 'B123',
    quantityUsed: '400 ml',
    animalsTreated: 12,
    administeredBy: 'Ann',
    reason: null,
    meatWithdrawalDays: 28,
    milkWithdrawalDays: null,
    meatWithdrawalEnds: '2026-06-29',
    milkWithdrawalEnds: null,
    group: { id: 'g1', name: 'Dairy herd' },
    voided: false,
    voidReason: null,
    history: [],
  };

  it('has an audit-friendly header and one row per treatment', () => {
    const lines = treatmentsCsv([row]).split('\r\n');
    expect(lines[0]).toBe(
      'Date,Group,Product,Batch,Quantity used,Animals treated,Administered by,Reason,' +
        'Meat withdrawal (days),Meat withdrawal ends,Milk withdrawal (days),Milk withdrawal ends,Status',
    );
    expect(lines[1]).toBe(
      '2026-06-01,Dairy herd,"Product, from label",B123,400 ml,12,Ann,,28,2026-06-29,,,',
    );
  });

  it('keeps voided treatments, marked with the reason (FR-6.5)', () => {
    const lines = treatmentsCsv([{ ...row, voided: true, voidReason: 'Entered twice' }]).split(
      '\r\n',
    );
    expect(lines[1]!.endsWith(',Voided: Entered twice')).toBe(true);
  });
});
