/**
 * v3 offline support: the rules the service worker follows. Kept free of service-worker globals
 * so they can be unit tested, and imported only by sw.ts so the build inlines them there.
 */

const VERSION = 'v1';
/** The app's own files: replaced on each release. */
export const APP_CACHE = `bellwether-app-${VERSION}`;
/** The last answer to each GraphQL query: cleared on log out. */
export const DATA_CACHE = `bellwether-data-${VERSION}`;
export const CACHES = [APP_CACHE, DATA_CACHE];
/** Fetched on install so the app opens offline. */
export const PRECACHE = ['/', '/manifest.webmanifest', '/favicon.svg'];

export type RequestKind = 'asset' | 'page' | 'graphql' | 'static' | 'other';

/**
 * - asset: Vite's hashed build files never change, so the cached copy is always right.
 * - page: any app route opens the cached app when there's no signal.
 * - graphql: network first; the last good answer to a query when offline.
 * - static: other files of ours (icons, manifest), network first.
 * - other: other sites (map tiles) and other methods pass straight through.
 */
export function requestKind(
  request: { method: string; url: string; mode: string },
  origin: string,
): RequestKind {
  const url = new URL(request.url);
  if (url.origin !== origin) return 'other';
  if (request.method === 'POST' && url.pathname === '/graphql') return 'graphql';
  if (request.method !== 'GET') return 'other';
  if (url.pathname.startsWith('/assets/')) return 'asset';
  if (request.mode === 'navigate') return 'page';
  return 'static';
}

/** True for a GraphQL query (stored for offline), false for mutations and anything unreadable. */
export function isQueryBody(body: string): boolean {
  try {
    const { query } = JSON.parse(body) as { query?: unknown };
    return typeof query === 'string' && !/^\s*(mutation|subscription)\b/.test(query);
  } catch {
    return false;
  }
}

/**
 * v4: a stored document's contents are never kept for offline use. They can be large, and a
 * vet report or passport shouldn't sit in the browser's cache.
 */
export function keepsOffline(body: string): boolean {
  return !/\bdocumentFile\s*\(/.test(body);
}

/** A GET URL standing in for a POSTed query and its variables, since caches only store GETs. */
export async function gqlCacheKey(body: string, origin: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${origin}/__offline/${hex}`;
}

/** Only complete answers are kept, so an error is never replayed offline. */
export function shouldStore(status: number, json: { data?: unknown; errors?: unknown }): boolean {
  return status === 200 && !json.errors;
}

/** What the app gets back when it can't reach the server, in the usual GraphQL error shape. */
export function offlineError(kind: 'query' | 'mutation') {
  const message =
    kind === 'mutation'
      ? 'You’re offline, so this was not saved. Try again when you have signal.'
      : 'You’re offline and this page hasn’t been opened on this device yet.';
  return { data: null, errors: [{ message, extensions: { code: 'OFFLINE' } }] };
}
