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
  /** e.g. smtp://localhost:1025 (Mailpit in dev). Unset: emails are logged, not sent. */
  smtpUrl: string | undefined;
  emailFrom: string;
  /** Public URL of the web app, for links in emails */
  appUrl: string;
  /** How often the briefing job runs, in minutes. 0 turns it off. */
  briefingJobMinutes: number;
  /** v3.2: one-click demo accounts on the login page. DEMO_ACCOUNTS=off turns them off. */
  demoAccounts: boolean;
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
    smtpUrl: env.SMTP_URL || undefined,
    emailFrom: env.EMAIL_FROM ?? 'Bellwether <briefing@bellwether.local>',
    appUrl: (env.APP_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
    briefingJobMinutes: Number(env.BRIEFING_JOB_MINUTES ?? 5),
    demoAccounts: env.DEMO_ACCOUNTS !== 'off',
  };
}
