import { base64ToBlob, expiryLabel, formatSize, readAsDataUrl } from '../src/documents';

describe('document helpers (v4)', () => {
  it.each([
    [14, '14 bytes'],
    [2048, '2 KB'],
    [1_572_864, '1.5 MB'],
  ])('formats %d as %s', (bytes, text) => {
    expect(formatSize(bytes)).toBe(text);
  });

  it.each([
    [null, '2026-06-11', null],
    [-2, '2026-05-30', { text: 'Expired 2 days ago', level: 'high' }],
    [-1, '2026-05-31', { text: 'Expired yesterday', level: 'high' }],
    [0, '2026-06-01', { text: 'Expires today', level: 'high' }],
    [1, '2026-06-02', { text: 'Expires tomorrow', level: 'medium' }],
    [30, '2026-07-01', { text: 'Expires in 30 days', level: 'medium' }],
    [31, '2026-07-02', { text: 'Expires 2 Jul 2026', level: 'low' }],
  ])('labels %s days to expiry', (days, expiresOn, label) => {
    expect(expiryLabel(days, expiresOn)).toEqual(label);
  });

  it('reads a file as a data URL and turns base64 back into the same bytes', async () => {
    const file = new File(['%PDF-1.7'], 'a.pdf', { type: 'application/pdf' });
    expect(await readAsDataUrl(file)).toBe('data:application/pdf;base64,JVBERi0xLjc=');
    const blob = base64ToBlob('JVBERi0xLjc=', 'application/pdf');
    expect(blob.type).toBe('application/pdf');
    expect(await readAsDataUrl(blob)).toBe('data:application/pdf;base64,JVBERi0xLjc=');
  });
});
