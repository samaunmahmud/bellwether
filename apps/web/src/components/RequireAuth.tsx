import { useQuery } from '@apollo/client';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ME_QUERY } from '../graphql/auth';

/** Shows its children to signed-in users and sends everyone else to log in (FR-8.1). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data, loading, error } = useQuery<{ me: { id: string } | null }>(ME_QUERY);

  if (loading) return <p aria-live="polite">Checking your account…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  if (!data?.me) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}
