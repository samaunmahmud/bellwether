import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  // The risk engine is a TypeScript-source workspace package, so bundle it into the API build.
  noExternal: ['@bellwether/risk-engine'],
});
