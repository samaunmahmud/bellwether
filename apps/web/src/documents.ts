/** v4: helpers for stored documents. */

/** Matches the API's limit, so a big file is refused before it's sent. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** What the file picker offers: PDFs and photos (a phone can take one there and then). */
export const ACCEPTED_FILES = 'application/pdf,image/jpeg,image/png,image/webp';

/** 2048 → "2 KB" */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`;
}

export type ExpiryLevel = 'low' | 'medium' | 'high';

/** Documents expiring within this many days are flagged, as on the API. */
export const EXPIRY_WARNING_DAYS = 30;

/** "Expires in 10 days" with a risk-style level, or null for a document that doesn't expire. */
export function expiryLabel(
  daysToExpiry: number | null,
  expiresOn: string | null,
): { text: string; level: ExpiryLevel } | null {
  if (daysToExpiry === null || !expiresOn) return null;
  const d = daysToExpiry;
  if (d < -1) return { text: `Expired ${-d} days ago`, level: 'high' };
  if (d === -1) return { text: 'Expired yesterday', level: 'high' };
  if (d === 0) return { text: 'Expires today', level: 'high' };
  if (d === 1) return { text: 'Expires tomorrow', level: 'medium' };
  if (d <= EXPIRY_WARNING_DAYS) return { text: `Expires in ${d} days`, level: 'medium' };
  const date = new Date(`${expiresOn}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return { text: `Expires ${date}`, level: 'low' };
}

/** The file as a `data:` URL, which the API accepts as it is. */
export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The file could not be read: try choosing it again'));
    reader.readAsDataURL(file);
  });
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/**
 * Hands the file to the browser: opened in a new tab, or saved with its own name. The object
 * URL is released once the browser has had time to use it.
 */
export function handOver(blob: Blob, fileName: string, mode: 'open' | 'save') {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  if (mode === 'save') link.download = fileName;
  else {
    link.target = '_blank';
    link.rel = 'noopener';
  }
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
