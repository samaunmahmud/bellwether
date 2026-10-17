import { useMutation } from '@apollo/client';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BrandMark } from '../components/BrandMark';
import { AuthForm, type Credentials } from '../components/AuthForm';
import { Icon, type IconName } from '../components/Icon';
import { LiveConditions } from '../components/LiveConditions';
import { Photo } from '../components/photos';
import { errorMessage } from '../errors';
import { LOG_IN, ME_QUERY, SIGN_UP, START_DEMO } from '../graphql/auth';

const DEFAULT_NEXT = '/farms';

/** Only follow `next` to a page on this site, never to another one (e.g. "//evil.example"). */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
    ? next
    : DEFAULT_NEXT;
}

const HIGHLIGHTS: Array<{ icon: IconName; text: string }> = [
  { icon: 'outlook', text: '14-day heat stress, flystrike, tick and fluke risk for every group' },
  { icon: 'register', text: 'Holding register, medicine book and cabinet, ready for inspection' },
  { icon: 'people', text: 'Tasks and records shared with the people who work your farm' },
];

/** What the demo is doing, shown in turn while it's built (it takes a few seconds). */
const DEMO_STEPS = [
  'Setting up Fellside Farm and its fields…',
  'Adding the ewes, lambs and suckler cows…',
  'Writing a season of register entries…',
  'Building Brookside Dairy…',
  'Inviting a worker and the vet to your team…',
  'Adding Bess the dog and Tom the cat…',
  'Nearly there…',
];

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
  const [startDemo] = useMutation(START_DEMO, options);
  const [demoStep, setDemoStep] = useState<number | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  useEffect(() => {
    if (demoStep === null) return;
    const timer = window.setTimeout(
      () => setDemoStep((s) => (s === null ? s : Math.min(s + 1, DEMO_STEPS.length - 1))),
      1400,
    );
    return () => window.clearTimeout(timer);
  }, [demoStep]);

  async function handleSubmit(credentials: Credentials) {
    await (mode === 'login' ? logIn : signUp)({ variables: credentials });
    navigate(next, { replace: true });
  }

  async function handleDemo() {
    setDemoError(null);
    setDemoStep(0);
    try {
      await startDemo();
      navigate(DEFAULT_NEXT, { replace: true });
    } catch (err) {
      setDemoError(errorMessage(err));
      setDemoStep(null);
    }
  }

  const loggingIn = mode === 'login';

  return (
    <div className="auth">
      <Photo name="gate" className="photo--drift auth__photo" />
      <aside className="auth__scene">
        <div className="auth__scene-inner">
          <Link to="/" className="auth__brand">
            <BrandMark /> Bellwether
          </Link>
          <div className="auth__pitch">
            <h2>Know what the weather means for your animals, before it happens.</h2>
            <ul className="auth__highlights">
              {HIGHLIGHTS.map((h, i) => (
                <li key={h.text} style={{ ['--i' as string]: i }}>
                  <span className="auth__highlight-icon">
                    <Icon name={h.icon} size={18} />
                  </span>
                  {h.text}
                </li>
              ))}
            </ul>
          </div>
          <LiveConditions postcode="LA9 4DQ" place="Kendal, Cumbria" />
        </div>
      </aside>

      <section className="auth__panel">
        <div className="auth__card">
          <nav className="auth__tabs" aria-label="Log in or create an account">
            <Link
              to={`/login${nextQuery}`}
              aria-current={loggingIn ? 'page' : undefined}
              className={loggingIn ? 'is-active' : ''}
            >
              Log in
            </Link>
            <Link
              to={`/signup${nextQuery}`}
              aria-current={loggingIn ? undefined : 'page'}
              className={loggingIn ? '' : 'is-active'}
            >
              Create account
            </Link>
            <span className={`auth__tab-ink auth__tab-ink--${mode}`} aria-hidden="true" />
          </nav>

          <div className="auth__mode" key={mode}>
            {loggingIn ? (
              <>
                <h1>Welcome back</h1>
                <p className="muted">Log in to see today’s risks and what needs doing.</p>
                <AuthForm mode="login" onSubmit={handleSubmit} />
                <p className="auth__switch">
                  New here? <Link to={`/signup${nextQuery}`}>Create an account</Link>
                </p>
              </>
            ) : (
              <>
                <h1>Create your account</h1>
                <p className="muted">
                  We use your email only to sign you in. Your farm records are visible only to you
                  and the people you invite.
                </p>
                <AuthForm mode="signup" onSubmit={handleSubmit} />
                <p className="auth__switch">
                  Already have an account? <Link to={`/login${nextQuery}`}>Log in</Link>
                </p>
              </>
            )}
          </div>

          <div className="auth__or">
            <span>or</span>
          </div>
          <button
            type="button"
            className="button--demo"
            onClick={handleDemo}
            disabled={demoStep !== null}
          >
            {demoStep !== null ? (
              <>
                <span className="spinner" aria-hidden="true" /> Building your demo…
              </>
            ) : (
              <>
                <Icon name="sparkle" /> Explore a demo account
              </>
            )}
          </button>
          {demoStep !== null ? (
            <p className="auth__demo-step" role="status" key={demoStep}>
              {DEMO_STEPS[demoStep]}
            </p>
          ) : (
            <p className="muted auth__demo-note">
              Two example farms, a team and two pets, private to you. No email needed.
            </p>
          )}
          {demoError && (
            <p className="error" role="alert">
              {demoError}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
