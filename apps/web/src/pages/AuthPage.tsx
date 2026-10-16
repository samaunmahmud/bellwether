import { useMutation } from '@apollo/client';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthForm, type Credentials } from '../components/AuthForm';
import { LOG_IN, ME_QUERY, SIGN_UP } from '../graphql/auth';

const DEFAULT_NEXT = '/farms';

/** Only follow `next` to a page on this site, never to another one (e.g. "//evil.example"). */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
    ? next
    : DEFAULT_NEXT;
}

/** Log in or sign up (FR-8.1), then go back to the page that asked for it. */
export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const nextQuery = params.get('next') ? `?next=${encodeURIComponent(next)}` : '';

  // Refresh "who am I" before leaving, so the next page knows we're signed in.
  const options = { refetchQueries: [{ query: ME_QUERY }], awaitRefetchQueries: true };
  const [logIn] = useMutation(LOG_IN, options);
  const [signUp] = useMutation(SIGN_UP, options);

  async function handleSubmit(credentials: Credentials) {
    await (mode === 'login' ? logIn : signUp)({ variables: credentials });
    navigate(next, { replace: true });
  }

  return (
    <section className="narrow">
      {mode === 'login' ? (
        <>
          <h1>Log in</h1>
          <AuthForm mode="login" onSubmit={handleSubmit} />
          <p>
            New here? <Link to={`/signup${nextQuery}`}>Create an account</Link>
          </p>
        </>
      ) : (
        <>
          <h1>Create an account</h1>
          <p className="muted">
            We use your email only to sign you in. Your farm records are visible only to you.
          </p>
          <AuthForm mode="signup" onSubmit={handleSubmit} />
          <p>
            Already have an account? <Link to={`/login${nextQuery}`}>Log in</Link>
          </p>
        </>
      )}
    </section>
  );
}
