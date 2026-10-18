/** Escapes text for a PDF string: backslashes and brackets. Non-Latin-1 characters become "?". */
const pdfText = (text: string) =>
  text.replace(/[^\x20-\x7e\xa0-\xff]/g, '?').replace(/[\\()]/g, (c) => `\\${c}`);

/**
 * v4: a plain one-page A4 PDF with a heading and some lines, for the demo accounts' documents.
 * Built by hand (a few objects and a cross-reference table) so no PDF library is needed.
 */
export function demoPdf(title: string, lines: string[]): Uint8Array {
  const text = [
    'BT /F1 20 Tf 56 770 Td',
    `(${pdfText(title)}) Tj`,
    '/F1 12 Tf 0 -36 Td',
    ...lines.flatMap((line) => [`(${pdfText(line)}) Tj`, '0 -20 Td']),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text, 'latin1')} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => {
    const offset = Buffer.byteLength(pdf, 'latin1');
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, 'latin1'));
}
