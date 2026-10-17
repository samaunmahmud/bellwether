import {
  DATA_CACHE,
  gqlCacheKey,
  isQueryBody,
  offlineError,
  requestKind,
  shouldStore,
} from '../src/offline/cacheRules';
import { clearOfflineData } from '../src/offline/registerOffline';

const ORIGIN = 'https://bellwether.test';

describe('which requests the offline cache handles', () => {
  it.each([
    ['GET', '/assets/index-abc123.js', 'navigate', 'asset'],
    ['GET', '/farms/1/tasks', 'navigate', 'page'],
    ['POST', '/graphql', 'cors', 'graphql'],
    ['GET', '/manifest.webmanifest', 'same-origin', 'static'],
    ['GET', '/icons/icon-192.png', 'no-cors', 'static'],
  ])('%s %s (%s) → %s', (method, path, mode, kind) => {
    expect(requestKind({ method, url: `${ORIGIN}${path}`, mode }, ORIGIN)).toBe(kind);
  });

  it('leaves other sites (map tiles) and other methods alone', () => {
    expect(
      requestKind(
        { method: 'GET', url: 'https://tile.openstreetmap.org/1/1/1.png', mode: 'cors' },
        ORIGIN,
      ),
    ).toBe('other');
    expect(requestKind({ method: 'PUT', url: `${ORIGIN}/graphql`, mode: 'cors' }, ORIGIN)).toBe(
      'other',
    );
  });
});

describe('GraphQL bodies', () => {
  it('stores queries but never mutations', () => {
    expect(isQueryBody(JSON.stringify({ query: 'query Farms { farms { id } }' }))).toBe(true);
    expect(isQueryBody(JSON.stringify({ query: '{ me { id } }' }))).toBe(true);
    expect(isQueryBody(JSON.stringify({ query: '  mutation AddTask { x }' }))).toBe(false);
    expect(isQueryBody(JSON.stringify({ query: 'subscription S { x }' }))).toBe(false);
    expect(isQueryBody('not json')).toBe(false);
    expect(isQueryBody(JSON.stringify({ nothing: true }))).toBe(false);
  });

  it('keys each query and its variables separately, and the same query the same way', async () => {
    const a = JSON.stringify({
      query: 'query F($id: ID!) { farm(id: $id) { id } }',
      variables: { id: '1' },
    });
    const b = JSON.stringify({
      query: 'query F($id: ID!) { farm(id: $id) { id } }',
      variables: { id: '2' },
    });
    expect(await gqlCacheKey(a, ORIGIN)).toBe(await gqlCacheKey(a, ORIGIN));
    expect(await gqlCacheKey(a, ORIGIN)).not.toBe(await gqlCacheKey(b, ORIGIN));
    expect(await gqlCacheKey(a, ORIGIN)).toMatch(
      /^https:\/\/bellwether\.test\/__offline\/[0-9a-f]{64}$/,
    );
  });

  it('only stores answers without errors', () => {
    expect(shouldStore(200, { data: { farms: [] } })).toBe(true);
    expect(shouldStore(200, { data: null, errors: [{ message: 'Sign in' }] })).toBe(false);
    expect(shouldStore(500, { data: { farms: [] } })).toBe(false);
  });

  it('explains offline saves in the GraphQL error shape the pages already show', () => {
    const body = offlineError('mutation');
    expect(body.errors[0]!.message).toMatch(/offline.*not saved/i);
    expect(body.errors[0]!.extensions.code).toBe('OFFLINE');
    expect(offlineError('query').errors[0]!.message).toMatch(/hasn’t been opened/);
  });
});

describe('clearing offline data on log out', () => {
  afterEach(() => {
    // @ts-expect-error test cleanup of a stubbed global
    delete globalThis.caches;
  });

  it('deletes the saved answers so the next person on the device can’t see them', async () => {
    const deleted: string[] = [];
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: {
        keys: async () => ['bellwether-app-v1', DATA_CACHE, 'bellwether-data-v0'],
        delete: async (name: string) => (deleted.push(name), true),
      },
    });
    await clearOfflineData();
    expect(deleted).toEqual([DATA_CACHE, 'bellwether-data-v0']);
  });

  it('does nothing where the browser has no cache storage', async () => {
    await expect(clearOfflineData()).resolves.toBeUndefined();
  });
});
