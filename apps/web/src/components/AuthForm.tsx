import { useState, type FormEvent } from 'react';
import { errorMessage } from '../errors';

export interface Credentials {
  email: string;
  password: string;
}

// Matches the API rule (docs/decisions.md, A11).
export const MIN_PASSWORD_LENGTH = 10;

interface Props {
  mode: 'login' | 'signup';
  onSubmit: (credentials: Credentials) => Promise<unknown>;
}

export function AuthForm({ mode, onSubmit }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signingUp = mode === 'signup';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (signingUp && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit({ email: email.trim(), password });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} aria-label={signingUp ? 'Sign up' : 'Log in'}>
      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete={signingUp ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {signingUp && <p className="muted">At least {MIN_PASSWORD_LENGTH} characters.</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy}>
        {signingUp ? 'Create account' : 'Log in'}
      </button>
    </form>
  );
}
