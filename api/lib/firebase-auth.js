'use strict';

const crypto = require('node:crypto');

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const MAX_TOKEN_LENGTH = 8192;
const CLOCK_SKEW_SECONDS = 60;
const DEFAULT_KEY_TTL_MS = 60 * 60 * 1000;
// Google rotates its signing keys rarely; don't hammer the endpoint when a token carries an unknown key id.
const REFRESH_COOLDOWN_MS = 60 * 1000;

class AuthError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AuthError';
    this.code = code;
  }
}

const store = { keys: new Map(), expiresAt: 0, fetchedAt: 0, inflight: null };

function resetKeyCache() {
  store.keys = new Map();
  store.expiresAt = 0;
  store.fetchedAt = 0;
  store.inflight = null;
}

async function fetchKeys(fetchImpl, now) {
  let res;
  try {
    res = await fetchImpl(JWKS_URL, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new AuthError('keys_unavailable');
  }
  if (!res.ok) throw new AuthError('keys_unavailable');

  const body = await res.json().catch(() => null);
  if (!body || !Array.isArray(body.keys)) throw new AuthError('keys_unavailable');

  const keys = new Map();
  for (const jwk of body.keys) {
    if (jwk?.kty !== 'RSA' || typeof jwk.kid !== 'string') continue;
    try {
      keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' }));
    } catch {
      // skip a key we cannot import
    }
  }
  if (keys.size === 0) throw new AuthError('keys_unavailable');

  const maxAge = Number(/max-age=(\d+)/.exec(res.headers?.get?.('cache-control') || '')?.[1]);
  store.keys = keys;
  store.fetchedAt = now();
  store.expiresAt = now() + (maxAge > 0 ? maxAge * 1000 : DEFAULT_KEY_TTL_MS);
}

async function keyFor(kid, { fetchImpl, now }) {
  const stale = now() >= store.expiresAt;
  const unknown = !store.keys.has(kid);
  const cooledDown = now() - store.fetchedAt >= REFRESH_COOLDOWN_MS;

  if (stale || (unknown && cooledDown)) {
    store.inflight ??= fetchKeys(fetchImpl, now).finally(() => {
      store.inflight = null;
    });
    await store.inflight;
  }

  const key = store.keys.get(kid);
  if (!key) throw new AuthError('unknown_key');
  return key;
}

/**
 * Verifies a Firebase Auth ID token without firebase-admin: RS256 signature against Google's public keys,
 * then the claims Firebase documents (audience, issuer, expiry, issue time, subject).
 */
async function verifyIdToken(token, { projectId, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  if (!projectId) throw new AuthError('not_configured');
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) throw new AuthError('malformed');

  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) throw new AuthError('malformed');

  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new AuthError('malformed');
  }
  if (!header || !payload || typeof payload !== 'object') throw new AuthError('malformed');
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new AuthError('bad_header');

  const key = await keyFor(header.kid, { fetchImpl, now });
  const signed = Buffer.from(`${parts[0]}.${parts[1]}`);
  if (!crypto.verify('sha256', signed, key, Buffer.from(parts[2], 'base64url'))) throw new AuthError('bad_signature');

  const nowSeconds = Math.floor(now() / 1000);
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) throw new AuthError('bad_audience');
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) throw new AuthError('expired');
  if (typeof payload.iat !== 'number' || payload.iat > nowSeconds + CLOCK_SKEW_SECONDS) throw new AuthError('bad_issue_time');
  if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) throw new AuthError('bad_subject');

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    emailVerified: payload.email_verified === true,
  };
}

module.exports = { verifyIdToken, AuthError, resetKeyCache, JWKS_URL };
