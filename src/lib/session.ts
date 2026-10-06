const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

function sessionSecret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || 'local-development-only';
}

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signingKey() {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function createSessionToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS;
  const payload = `authenticated.${expiresAt}`;
  const signature = await crypto.subtle.sign('HMAC', await signingKey(), new TextEncoder().encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token?: string) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'authenticated') return false;

  const expiresAt = Number(parts[1]);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;

  const payload = `${parts[0]}.${parts[1]}`;
  const expected = await crypto.subtle.sign('HMAC', await signingKey(), new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(expected)) === parts[2];
}

export { SESSION_LIFETIME_SECONDS };
