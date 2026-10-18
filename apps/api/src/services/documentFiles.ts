import { sniffDocumentType } from '../domain/keeping';
import { appError } from '../errors';

/**
 * v4: largest file kept. Enough for a phone photo or a scanned certificate; files are stored in
 * Postgres (A92), so this keeps the database and each request small.
 */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const MAX_FILE_NAME = 120;

/**
 * The file from base64 (or a `data:` URL, as the browser's FileReader gives it), checked to be
 * a PDF or a JPEG, PNG or WebP photo by its contents.
 */
export function decodeDocument(raw: string) {
  const base64 = raw.replace(/^data:[^,]*;base64,/, '').replace(/\s+/g, '');
  if (!base64) throw appError('BAD_INPUT', 'The file is empty');
  // Checked before decoding, so a huge upload is never held twice in memory.
  if (
    Math.floor((base64.length * 3) / 4) - (base64.match(/=+$/)?.[0].length ?? 0) >
    MAX_DOCUMENT_BYTES
  )
    throw appError('BAD_INPUT', 'Files can be up to 5 MB');
  if (!/^[A-Za-z\d+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0)
    throw appError('BAD_INPUT', 'The file could not be read: try choosing it again');
  const bytes = new Uint8Array(Buffer.from(base64, 'base64'));
  const mimeType = sniffDocumentType(bytes);
  if (!mimeType) throw appError('BAD_INPUT', 'Upload a PDF, JPEG, PNG or WebP file');
  return { bytes, mimeType };
}

/** "C:\scans\licence.pdf" → "licence.pdf": no folders or control characters, 120 at most. */
export function tidyFileName(raw: string) {
  const name = (raw.split(/[\\/]/).pop() ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"]/g, '')
    .trim();
  if (!name) throw appError('BAD_INPUT', 'The file needs a file name');
  if (name.length <= MAX_FILE_NAME) return name;
  const ext = name.match(/\.[a-z\d]{1,5}$/i)?.[0] ?? '';
  return name.slice(0, MAX_FILE_NAME - ext.length) + ext;
}

/** "movement licence.pdf" → "movement licence" */
export const titleFromFileName = (fileName: string) =>
  fileName.replace(/\.[a-z\d]{1,5}$/i, '').trim() || fileName;

/** Whole days from one YYYY-MM-DD to another; negative if `to` is earlier. */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
