export interface Config {
  port: number;
  redisUrl: string | undefined;
  postcodesApiBase: string;
  weatherApiBase: string;
  logLevel: 'debug' | 'info';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 4000),
    redisUrl: env.REDIS_URL || undefined,
    postcodesApiBase: env.POSTCODES_API_BASE ?? 'https://api.postcodes.io',
    weatherApiBase: env.WEATHER_API_BASE ?? 'https://api.open-meteo.com',
    logLevel: env.LOG_LEVEL === 'debug' ? 'debug' : 'info',
  };
}
