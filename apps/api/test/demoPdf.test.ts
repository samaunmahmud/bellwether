import { describe, expect, it } from 'vitest';
import { sniffDocumentType } from '../src/domain/keeping';
import { demoPdf } from '../src/services/demoPdf';

describe('demo PDFs (v4)', () => {
  it('makes a one-page PDF whose cross-reference table points at each object', () => {
    const bytes = demoPdf('TB test result', ['Herd: Milking herd', 'Result: clear (made up)']);
    const text = Buffer.from(bytes).toString('latin1');
    expect(sniffDocumentType(bytes)).toBe('application/pdf');
    expect(text).toContain('(TB test result) Tj');
    expect(text).toContain('(Result: clear \\(made up\\)) Tj');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    const startxref = Number(/startxref\s+(\d+)/.exec(text)![1]);
    expect(text.slice(startxref).startsWith('xref')).toBe(true);
    const offsets = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n/gm)].map((m) =>
      Number(m[1]),
    );
    expect(offsets).toHaveLength(5);
    offsets.forEach((offset, i) =>
      expect(text.slice(offset)).toMatch(new RegExp(`^${i + 1} 0 obj`)),
    );
  });
});
