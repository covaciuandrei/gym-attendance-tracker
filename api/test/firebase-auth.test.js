'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { verifyIdToken, AuthError, resetKeyCache, JWKS_URL } = require('../lib/firebase-auth');

const PROJECT = 'demo-project';
const NOW_MS = 1_800_000_000_000;
const NOW_S = Math.floor(NOW_MS / 1000);

function makeKey(kid) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { kid, privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' } };
}

const b64 = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

function signToken(key, claims = {}, header = {}) {
  const payload = {
    aud: PROJECT,
    iss: `https://securetoken.google.com/${PROJECT}`,
    sub: 'user-1',
    iat: NOW_S - 60,
    exp: NOW_S + 3600,
    email: 'Someone@Example.com',
    email_verified: true,
    ...claims,
  };
  const head = b64({ alg: 'RS256', kid: key.kid, typ: 'JWT', ...header });
  const body = b64(payload);
  const signature = crypto.sign('sha256', Buffer.from(`${head}.${body}`), key.privateKey).toString('base64url');
  return `${head}.${body}.${signature}`;
}

function jwksFetch(keys, { maxAge = 3600, calls = { count: 0 } } = {}) {
  const impl = async (url) => {
    assert.equal(url, JWKS_URL);
    calls.count++;
    return {
      ok: true,
      headers: { get: (name) => (name.toLowerCase() === 'cache-control' ? `public, max-age=${maxAge}, must-revalidate` : null) },
      json: async () => ({ keys: keys.map((k) => k.jwk) }),
    };
  };
  impl.calls = calls;
  return impl;
}

const verify = (token, fetchImpl, extra = {}) => verifyIdToken(token, { projectId: PROJECT, fetchImpl, now: () => NOW_MS, ...extra });
const rejects = (promise, code) => assert.rejects(promise, (err) => err instanceof AuthError && err.code === code, `expected ${code}`);

const key = makeKey('key-1');

test.beforeEach(() => resetKeyCache());

test('accepts a valid Firebase ID token and returns the identity', async () => {
  const user = await verify(signToken(key), jwksFetch([key]));
  assert.deepEqual(user, { uid: 'user-1', email: 'Someone@Example.com', emailVerified: true });
});

test('reports an unverified email without rejecting the token', async () => {
  const user = await verify(signToken(key, { email_verified: false }), jwksFetch([key]));
  assert.equal(user.emailVerified, false);
  const missing = await verify(signToken(key, { email_verified: undefined, email: undefined }), jwksFetch([key]));
  assert.equal(missing.emailVerified, false);
  assert.equal(missing.email, null);
});

test('rejects a token signed by another key, even with a known key id', async () => {
  const attacker = makeKey('key-1');
  await rejects(verify(signToken(attacker), jwksFetch([key])), 'bad_signature');
});

test('rejects tampered payloads', async () => {
  const [head, , signature] = signToken(key).split('.');
  const forged = `${head}.${b64({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'admin', iat: NOW_S, exp: NOW_S + 999 })}.${signature}`;
  await rejects(verify(forged, jwksFetch([key])), 'bad_signature');
});

test('rejects the none and HS256 algorithms', async () => {
  const body = b64({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'x', iat: NOW_S, exp: NOW_S + 60 });
  await rejects(verify(`${b64({ alg: 'none', kid: 'key-1' })}.${body}.`, jwksFetch([key])), 'malformed');
  await rejects(verify(`${b64({ alg: 'none', kid: 'key-1' })}.${body}.abc`, jwksFetch([key])), 'bad_header');
  await rejects(verify(signToken(key, {}, { alg: 'HS256' }), jwksFetch([key])), 'bad_header');
  await rejects(verify(signToken(key, {}, { kid: undefined }), jwksFetch([key])), 'bad_header');
});

test('checks audience and issuer', async () => {
  await rejects(verify(signToken(key, { aud: 'other-project' }), jwksFetch([key])), 'bad_audience');
  await rejects(verify(signToken(key, { iss: 'https://securetoken.google.com/other-project' }), jwksFetch([key])), 'bad_audience');
  await rejects(verify(signToken(key, { iss: 'https://accounts.google.com' }), jwksFetch([key])), 'bad_audience');
});

test('checks expiry, issue time and subject', async () => {
  await rejects(verify(signToken(key, { exp: NOW_S - 1 }), jwksFetch([key])), 'expired');
  await rejects(verify(signToken(key, { exp: undefined }), jwksFetch([key])), 'expired');
  await rejects(verify(signToken(key, { iat: NOW_S + 3600 }), jwksFetch([key])), 'bad_issue_time');
  await rejects(verify(signToken(key, { sub: '' }), jwksFetch([key])), 'bad_subject');
  await rejects(verify(signToken(key, { sub: 'x'.repeat(129) }), jwksFetch([key])), 'bad_subject');
  // a little clock skew in the issue time is fine
  assert.equal((await verify(signToken(key, { iat: NOW_S + 30 }), jwksFetch([key]))).uid, 'user-1');
});

test('rejects malformed input before touching the network', async () => {
  const fetchImpl = jwksFetch([key]);
  for (const bad of ['', 'abc', 'a.b', 'a.b.c.d', 'a b.c.d', `${'a'.repeat(9000)}.b.c`, null, undefined, 42]) {
    await rejects(verify(bad, fetchImpl), 'malformed');
  }
  assert.equal(fetchImpl.calls.count, 0);
});

test('requires a project id', async () => {
  await rejects(verifyIdToken(signToken(key), { fetchImpl: jwksFetch([key]), now: () => NOW_MS }), 'not_configured');
});

test('caches Google keys for the advertised max-age and refreshes afterwards', async () => {
  let clock = NOW_MS;
  const calls = { count: 0 };
  const fetchImpl = jwksFetch([key], { maxAge: 100, calls });
  const check = () => verifyIdToken(signToken(key), { projectId: PROJECT, fetchImpl, now: () => clock });

  await check();
  await check();
  assert.equal(calls.count, 1);
  clock += 101_000;
  await verifyIdToken(signToken(key, { exp: NOW_S + 7200 }), { projectId: PROJECT, fetchImpl, now: () => clock });
  assert.equal(calls.count, 2);
});

test('shares one download between concurrent verifications', async () => {
  const calls = { count: 0 };
  const fetchImpl = jwksFetch([key], { calls });
  await Promise.all([verify(signToken(key), fetchImpl), verify(signToken(key), fetchImpl), verify(signToken(key), fetchImpl)]);
  assert.equal(calls.count, 1);
});

test('re-downloads once for an unknown key id but not more than once a minute', async () => {
  const rotated = makeKey('key-2');
  let clock = NOW_MS;
  const calls = { count: 0 };
  let published = [key];
  const fetchImpl = async () => {
    calls.count++;
    return { ok: true, headers: { get: () => 'max-age=3600' }, json: async () => ({ keys: published.map((k) => k.jwk) }) };
  };
  const run = (token) => verifyIdToken(token, { projectId: PROJECT, fetchImpl, now: () => clock });

  await run(signToken(key));
  assert.equal(calls.count, 1);

  // an unknown kid right after a download: no new download
  await rejects(run(signToken(rotated)), 'unknown_key');
  assert.equal(calls.count, 1);

  // after the cooldown Google has published the new key
  clock += 61_000;
  published = [key, rotated];
  const user = await run(signToken(rotated, { exp: NOW_S + 7200 }));
  assert.equal(user.uid, 'user-1');
  assert.equal(calls.count, 2);
});

test('surfaces key download problems as keys_unavailable', async () => {
  await rejects(verify(signToken(key), async () => { throw new Error('offline'); }), 'keys_unavailable');
  resetKeyCache();
  await rejects(verify(signToken(key), async () => ({ ok: false, headers: { get: () => null }, json: async () => ({}) })), 'keys_unavailable');
  resetKeyCache();
  await rejects(verify(signToken(key), async () => ({ ok: true, headers: { get: () => null }, json: async () => ({ keys: [] }) })), 'keys_unavailable');
  resetKeyCache();
  await rejects(verify(signToken(key), async () => ({ ok: true, headers: { get: () => null }, json: async () => ({ nope: true }) })), 'keys_unavailable');
});
