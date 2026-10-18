/**
 * v3 service worker: opens the app and the pages already visited when there's no signal.
 * Built by Vite to /sw.js (see vite.config.ts). It must not share code with the app bundle, so
 * it imports only cacheRules.ts, which the build inlines.
 */
import {
  APP_CACHE,
  CACHES,
  DATA_CACHE,
  PRECACHE,
  gqlCacheKey,
  isQueryBody,
  keepsOffline,
  offlineError,
  requestKind,
  shouldStore,
} from './cacheRules';

// The DOM lib has no service-worker types, and adding the WebWorker lib clashes with it,
// so the few parts used here are declared locally.
interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}
interface FetchEvent extends ExtendableEvent {
  request: Request;
  respondWith(response: Promise<Response>): void;
}
interface ServiceWorkerScope {
  location: Location;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: 'install' | 'activate', listener: (e: ExtendableEvent) => void): void;
  addEventListener(type: 'fetch', listener: (e: FetchEvent) => void): void;
}

const sw = self as unknown as ServiceWorkerScope;
const origin = sw.location.origin;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => sw.skipWaiting()),
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => !CACHES.includes(n)).map((n) => caches.delete(n))),
      )
      .then(() => sw.clients.claim()),
  );
});

async function cacheFirst(request: Request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await (await caches.open(APP_CACHE)).put(request, response.clone());
  return response;
}

async function networkFirst(request: Request, fallbackUrl?: string) {
  try {
    const response = await fetch(request);
    if (response.ok)
      await (await caches.open(APP_CACHE)).put(fallbackUrl ?? request, response.clone());
    return response;
  } catch (err) {
    const cached = await caches.match(fallbackUrl ?? request);
    if (cached) return cached;
    throw err;
  }
}

async function graphql(request: Request) {
  const body = await request.clone().text();
  const isQuery = isQueryBody(body);
  try {
    const response = await fetch(request);
    if (isQuery && keepsOffline(body)) {
      const copy = response.clone();
      if (shouldStore(copy.status, (await copy.json()) as { errors?: unknown })) {
        await (
          await caches.open(DATA_CACHE)
        ).put(await gqlCacheKey(body, origin), response.clone());
      }
    }
    return response;
  } catch {
    if (!isQuery) return json(offlineError('mutation'));
    const cached = await caches.match(await gqlCacheKey(body, origin));
    return cached ?? json(offlineError('query'));
  }
}

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  switch (requestKind(request, origin)) {
    case 'asset':
      return event.respondWith(cacheFirst(request));
    case 'page':
      // Every route is the same single-page app.
      return event.respondWith(networkFirst(request, '/'));
    case 'graphql':
      return event.respondWith(graphql(request));
    case 'static':
      return event.respondWith(networkFirst(request));
    default:
      return;
  }
});
