// Not imported from cacheRules: sharing a module with sw.ts would split it into a chunk the
// classic service worker script can't import.
const DATA_CACHE_PREFIX = 'bellwether-data-';

/** Registers the service worker in production builds; Vite's dev server serves files itself. */
export function registerOffline() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app still works online without it.
    });
  });
}

/** Deletes saved answers, so the next person to use this device can't read them offline. */
export async function clearOfflineData() {
  if (typeof caches === 'undefined') return;
  const names = await caches.keys();
  await Promise.all(
    names.filter((n) => n.startsWith(DATA_CACHE_PREFIX)).map((n) => caches.delete(n)),
  );
}
