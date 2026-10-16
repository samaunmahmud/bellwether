import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env itself. Load the repo-root .env for local dev if there is one.
if (existsSync('../../.env')) process.loadEnvFile('../../.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Only migrate/introspect commands need a URL; `prisma generate` works without one (e.g. in CI).
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
