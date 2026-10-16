import { Redis } from 'ioredis';
import type { Logger } from '../logger';

export interface Cache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export const TTL = {
  postcode: 60 * 60 * 24 * 30, // 30 days
  weather: 60 * 60, // 1 hour
} as const;

/** Simple in-memory cache, used in tests and when no REDIS_URL is set. */
export class MemoryCache implements Cache {
  private store = new Map<string, { value: string; expiresAt: number }>();

  constructor(private now: () => number = Date.now) {}

  async get(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number) {
    this.store.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }
}

export function createRedisCache(url: string): Cache {
  const redis = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  return {
    async get(key) {
      if (redis.status === 'wait') await redis.connect();
      return redis.get(key);
    },
    async set(key, value, ttlSeconds) {
      if (redis.status === 'wait') await redis.connect();
      await redis.set(key, value, 'EX', ttlSeconds);
    },
  };
}

/**
 * Read-through cache helper. If the cache itself fails (e.g. Redis is down),
 * we log a warning and fall back to calling the loader directly, so the app keeps working.
 */
export async function getOrLoad<T>(
  cache: Cache,
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
  logger: Logger,
): Promise<T> {
  try {
    const hit = await cache.get(key);
    if (hit !== null) {
      logger.debug(`cache hit ${key}`);
      return JSON.parse(hit) as T;
    }
    logger.debug(`cache miss ${key}`);
  } catch (err) {
    logger.warn(`cache read failed for ${key}, falling back: ${(err as Error).message}`);
  }

  const value = await load();

  try {
    await cache.set(key, JSON.stringify(value), ttlSeconds);
  } catch (err) {
    logger.warn(`cache write failed for ${key}: ${(err as Error).message}`);
  }
  return value;
}
