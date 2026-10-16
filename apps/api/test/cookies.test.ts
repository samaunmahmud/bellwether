import { describe, expect, it } from 'vitest';
import { clearSessionCookie, readCookie, sessionCookie } from '../src/auth/cookies';

describe('readCookie', () => {
  it('finds a cookie among several', () => {
    expect(readCookie('a=1; bw_session=abc123; b=2', 'bw_session')).toBe('abc123');
  });

  it('returns null when the header or cookie is missing', () => {
    expect(readCookie(null, 'bw_session')).toBeNull();
    expect(readCookie('a=1', 'bw_session')).toBeNull();
    expect(readCookie('bw_sessionx=1', 'bw_session')).toBeNull();
  });
});

describe('session cookie (A10)', () => {
  it('is httpOnly, SameSite=Lax and lasts the given time', () => {
    expect(sessionCookie('tok', { maxAgeSeconds: 60, secure: false })).toBe(
      'bw_session=tok; Path=/; HttpOnly; SameSite=Lax; Max-Age=60',
    );
  });

  it('is Secure when asked', () => {
    expect(sessionCookie('tok', { maxAgeSeconds: 60, secure: true })).toMatch(/; Secure$/);
  });

  it('is cleared by expiring it immediately', () => {
    expect(clearSessionCookie(false)).toBe(
      'bw_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    );
  });
});
