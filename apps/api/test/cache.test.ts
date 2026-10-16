import { describe, expect, it, vi } from 'vitest';
import { getOrLoad, MemoryCache } from '../src/cache/cache';
import { silentLogger } from '../src/logger';
import { brokenCache } from './fakes';

describe('MemoryCache', () => {
  it('returns stored values until they expire', async () => {
    let now = 0;
    const cache = new MemoryCache(() => now);
    await cache.set('k', 'v', 10);
    expect(await cache.get('k')).toBe('v');
    now = 10_000;
    expect(await cache.get('k')).toBeNull();
  });
});

describe('getOrLoad', () => {
  it('loads on a miss, then serves from cache', async () => {
    const cache = new MemoryCache();
    const load = vi.fn().mockResolvedValue({ a: 1 });

    expect(await getOrLoad(cache, 'k', 60, load, silentLogger)).toEqual({ a: 1 });
    expect(await getOrLoad(cache, 'k', 60, load, silentLogger)).toEqual({ a: 1 });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('falls back to the loader when the cache is down (e.g. Redis unavailable)', async () => {
    const warn = vi.fn();
    const load = vi.fn().mockResolvedValue('fresh');

    const result = await getOrLoad(brokenCache, 'k', 60, load, { ...silentLogger, warn });

    expect(result).toBe('fresh');
    expect(warn).toHaveBeenCalledTimes(2); // failed read + failed write
  });

  it('lets loader errors propagate', async () => {
    const load = vi.fn().mockRejectedValue(new Error('upstream down'));
    await expect(getOrLoad(new MemoryCache(), 'k', 60, load, silentLogger)).rejects.toThrow(
      'upstream down',
    );
  });
});
