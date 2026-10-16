export interface Config {
  port: number;
  redisUrl: string | undefined;
  databaseUrl: string | undefined;
  postcodesApiBase: string;
  weatherApiBase: string;
  weatherArchiveApiBase: string;
  logLevel: 'debug' | 'info';
  /** Session cookies get `Secure` in production (A10). */
  secureCookies: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 4000),
    redisUrl: env.REDIS_URL || undefined,
    databaseUrl: env.DATABASE_URL || undefined,
    postcodesApiBase: env.POSTCODES_API_BASE ?? 'https://api.postcodes.io',
    weatherApiBase: env.WEATHER_API_BASE ?? 'https://api.open-meteo.com',
    weatherArchiveApiBase: env.WEATHER_ARCHIVE_API_BASE ?? 'https://archive-api.open-meteo.com',
    logLevel: env.LOG_LEVEL === 'debug' ? 'debug' : 'info',
    secureCookies: env.NODE_ENV === 'production',
  };
}
