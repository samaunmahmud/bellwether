/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // v3: the service worker is its own entry, served at /sw.js so it controls the whole site.
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        sw: fileURLToPath(new URL('src/offline/sw.ts', import.meta.url)),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  server: {
    port: 5173,
    // IPv4 explicitly: on some machines `localhost` binds to ::1 only and browsers can't connect.
    host: '127.0.0.1',
    proxy: {
      '/graphql': 'http://localhost:4000',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.tsx', 'test/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/**/*.{ts,tsx}'], reporter: ['text', 'html'] },
  },
});
