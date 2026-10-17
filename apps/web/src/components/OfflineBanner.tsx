import { useEffect, useState } from 'react';

/** v3: a notice while the device has no connection. */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <p className="offline-banner" role="status">
      You’re offline. Pages you’ve opened before still show their last saved version; changes can’t
      be saved until you’re back online.
    </p>
  );
}
