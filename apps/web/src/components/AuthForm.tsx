import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { errorMessage } from '../errors';
import { Icon } from './Icon';

export interface Credentials {
  email: string;
  password: string;
}

// Matches the API rule (docs/decisions.md, A11).
export const MIN_PASSWORD_LENGTH = 10;

const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'] as const;

/**
 * A rough guide to how guessable a new password is, from its length and variety. Long
 * passphrases score best. A hint for the person typing, not a security check.
 */
export function passwordStrength(password: string) {
  const label = (score: number) => ({ score, label: STRENGTH_LABELS[score]! });
  if (password.length < MIN_PASSWORD_LENGTH) return label(0);
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9\s]/].filter((r) =>
    r.test(password),
  ).length;
  if (new Set(password).size < 4) return label(1);
  if (password.length >= 16 && (/\s/.test(password) || kinds >= 3)) return label(4);
  if (password.length >= 12 && kinds >= 3) return label(3);
  if (kinds >= 2) return label(2);
  return label(1);
}

interface Props {
  mode: 'login' | 'signup';
  onSubmit: (credentials: Credentials) => Promise<unknown>;
}

export function AuthForm({ mode, onSubmit }: Props) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped on each error so the shake animation replays.
  const [attempt, setAttempt] = useState(0);
  const signingUp = mode === 'signup';
  const strength = passwordStrength(password);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (signingUp && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters`);
      setAttempt((n) => n + 1);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit({ email: email.trim(), password });
    } catch (err) {
      setError(errorMessage(err));
      setAttempt((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  const checkCaps = (e: KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(e.getModifierState?.('CapsLock') ?? false);

  return (
    <form
      key={attempt}
      className={`form auth-form${error ? ' auth-form--error' : ''}`}
      onSubmit={handleSubmit}
      aria-label={signingUp ? 'Sign up' : 'Log in'}
    >
      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
      </label>

      <div className="field">
        <label htmlFor={`${id}-password`}>Password</label>
        <div className="password-field">
          <input
            id={`${id}-password`}
            type={showPassword ? 'text' : 'password'}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={checkCaps}
            onKeyUp={checkCaps}
            onBlur={() => setCapsLock(false)}
            aria-describedby={signingUp ? `${id}-strength` : undefined}
            required
          />
          <button
            type="button"
            className="password-field__toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            <Icon name={showPassword ? 'eyeOff' : 'eye'} />
          </button>
        </div>
        {capsLock && (
          <p className="field__hint field__hint--warn">
            <Icon name="alert" size={16} /> Caps Lock is on
          </p>
        )}
        {signingUp && (
          <div className="strength" id={`${id}-strength`} aria-live="polite">
            <div className={`strength__bar strength__bar--${strength.score}`} aria-hidden="true">
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={n <= strength.score ? 'is-on' : ''} />
              ))}
            </div>
            <span className="strength__label">
              {password ? strength.label : `At least ${MIN_PASSWORD_LENGTH} characters`}
              {password && strength.score < 3 && ' · a few words together work well'}
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="auth-form__submit">
        {busy && <span className="spinner" aria-hidden="true" />}
        {signingUp ? 'Create account' : 'Log in'}
      </button>
    </form>
  );
}
