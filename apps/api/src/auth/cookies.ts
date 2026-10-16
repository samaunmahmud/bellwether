export const SESSION_COOKIE = 'bw_session';

/** Reads one cookie from a `Cookie` request header. */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return null;
}

const ATTRIBUTES = 'Path=/; HttpOnly; SameSite=Lax';

/** A10: httpOnly so page scripts can't read it, SameSite=Lax so cross-site POSTs don't carry it. */
export function sessionCookie(
  token: string,
  options: { maxAgeSeconds: number; secure: boolean },
): string {
  const cookie = `${SESSION_COOKIE}=${token}; ${ATTRIBUTES}; Max-Age=${options.maxAgeSeconds}`;
  return options.secure ? `${cookie}; Secure` : cookie;
}

export function clearSessionCookie(secure: boolean): string {
  return sessionCookie('', { maxAgeSeconds: 0, secure });
}
