'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { handleAnalyze, handleHealth, parseBody, TOKEN_HEADER } = require('../lib/handlers');
const { AuthError } = require('../lib/firebase-auth');
const { AccessError } = require('../lib/access');
const { resetLimits, LIMITS } = require('../lib/security');
const { DEFAULT_MODELS } = require('../lib/analyze');

const ENV = { GEMINI_API_KEY: 'test-key', FIREBASE_PROJECT_ID: 'demo-project' };
const IP = '203.0.113.7:5555';
const withToken = (token, ip = IP) => ({ [TOKEN_HEADER]: token, 'x-azure-clientip': ip });

const goodOutput = {
  is_food: true,
  meal_name: 'Chicken and rice',
  comment: 'About 150 g chicken and 200 g cooked rice.',
  confidence: 'high',
  items: [
    { name: 'Grilled chicken breast', grams: 150, kcal: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4, fiber_g: 0, sugar_g: 0 },
    { name: 'White rice', grams: 200, kcal: 260, protein_g: 5.4, carbs_g: 57, fat_g: 0.6, fiber_g: 0.8, sugar_g: 0 },
  ],
};
const geminiOk = async () => ({ status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(goodOutput) }] } }] }) });

/** Maps fake tokens to identities so no real signature is needed in these tests. */
function fakeVerifier(users) {
  return async (token) => {
    if (token === 'keys-down') throw new AuthError('keys_unavailable');
    const user = users[token];
    if (!user) throw new AuthError('bad_signature');
    return user;
  };
}

const alice = { uid: 'alice', email: 'Alice@example.com', emailVerified: true, admin: false };
const bob = { uid: 'bob', email: 'bob@example.com', emailVerified: true, admin: false };
const carol = { uid: 'carol', email: 'carol@example.com', emailVerified: true, admin: false };
const mallory = { uid: 'mallory', email: 'mallory@example.com', emailVerified: false, admin: false };
const root = { uid: 'root', email: 'owner@example.com', emailVerified: true, admin: true };

// The admin switched alice and bob on; carol has not been switched on.
const switchedOn = new Set(['alice', 'bob']);
function accessCheck() {
  const calls = [];
  const fn = async (request) => {
    calls.push(request);
    return switchedOn.has(request.uid);
  };
  fn.calls = calls;
  return fn;
}

const deps = (extra = {}) => ({ verifyToken: fakeVerifier({ alice, bob, carol, mallory, root }), fetchImpl: geminiOk, checkAccess: accessCheck(), ...extra });
const analyzeAs = (token, extra = {}) =>
  handleAnalyze({ method: 'POST', headers: withToken(token), body: { note: '2 eggs' }, env: ENV, deps: deps(), ...extra });
const body = (res) => JSON.parse(res.body);

test.beforeEach(() => resetLimits());

test('a verified user gets a normalised estimate', async () => {
  const res = await analyzeAs('alice');
  assert.equal(res.status, 200);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  const data = body(res);
  assert.equal(data.totals.kcal, 508);
  assert.equal(data.model, DEFAULT_MODELS[0]);
});

test('rejects wrong methods, missing, invalid and unverified identities', async () => {
  assert.equal((await handleAnalyze({ method: 'GET', headers: withToken('alice'), env: ENV, deps: deps() })).status, 405);
  assert.equal((await handleAnalyze({ method: 'POST', headers: { 'x-azure-clientip': IP }, body: { note: 'x' }, env: ENV, deps: deps() })).status, 401);
  assert.equal((await analyzeAs('forged')).status, 401);
  const unverified = await analyzeAs('mallory');
  assert.equal(unverified.status, 403);
  assert.equal(body(unverified).error, 'email_not_verified');
});

test('is unavailable when the server is not configured', async () => {
  assert.equal((await analyzeAs('alice', { env: { GEMINI_API_KEY: 'k' } })).status, 503);
  assert.equal((await analyzeAs('alice', { env: { FIREBASE_PROJECT_ID: 'p' } })).status, 503);
  assert.equal(body(await analyzeAs('alice', { env: {} })).error, 'not_configured');
});

test('only accounts the admin switched on can use the AI', async () => {
  assert.equal((await analyzeAs('alice')).status, 200);

  const denied = await analyzeAs('carol');
  assert.equal(denied.status, 403);
  assert.equal(body(denied).error, 'not_allowed');
});

test('the admin always has access, without anybody having to switch them on', async () => {
  const checkAccess = accessCheck();
  const res = await analyzeAs('root', { deps: deps({ checkAccess }) });
  assert.equal(res.status, 200);
  assert.equal(checkAccess.calls.length, 0);
});

test('the access check gets the account, its own token and the environment, and runs before any AI call', async () => {
  const checkAccess = accessCheck();
  let geminiCalls = 0;
  const fetchImpl = async (...args) => {
    geminiCalls++;
    return geminiOk(...args);
  };

  await analyzeAs('carol', { deps: deps({ checkAccess, fetchImpl }) });
  assert.equal(geminiCalls, 0, 'a refused account must never reach the AI');
  assert.equal(checkAccess.calls.length, 1);
  assert.equal(checkAccess.calls[0].uid, 'carol');
  assert.equal(checkAccess.calls[0].idToken, 'carol');
  assert.equal(checkAccess.calls[0].env.FIREBASE_PROJECT_ID, ENV.FIREBASE_PROJECT_ID);
});

test('an unverified email is refused before access is even looked at', async () => {
  const checkAccess = accessCheck();
  assert.equal((await analyzeAs('mallory', { deps: deps({ checkAccess }) })).status, 403);
  assert.equal(checkAccess.calls.length, 0);
});

test('when the switches cannot be read the request fails closed with a retryable error', async () => {
  const unavailable = async () => {
    throw new AccessError('unavailable');
  };
  const res = await analyzeAs('alice', { deps: deps({ checkAccess: unavailable }) });
  assert.equal(res.status, 503);
  assert.equal(body(res).error, 'access_unavailable');

  const unexpected = async () => {
    throw new TypeError('boom');
  };
  assert.equal((await analyzeAs('alice', { deps: deps({ checkAccess: unexpected }) })).status, 503);

  const rejected = async () => {
    throw new AccessError('unauthorized');
  };
  const retry = await analyzeAs('alice', { deps: deps({ checkAccess: rejected }) });
  assert.equal(retry.status, 401, 'a token Firestore refuses should be renewed by the client');
});

test('a refused account does not use up the rate limit of anybody else', async () => {
  for (let i = 0; i < LIMITS.userBurst.limit + 5; i++) assert.equal((await analyzeAs('carol')).status, 403);
  assert.equal((await analyzeAs('alice')).status, 200);
});

test('signature problems on the key download are a 503, not a 401', async () => {
  const res = await analyzeAs('keys-down');
  assert.equal(res.status, 503);
  assert.equal(body(res).error, 'auth_unavailable');
});

test('wrong tokens are throttled per address, but a valid session is never locked out', async () => {
  for (let i = 0; i < LIMITS.failures.limit; i++) assert.equal((await analyzeAs('forged')).status, 401);
  const blocked = await analyzeAs('forged');
  assert.equal(blocked.status, 429);
  assert.equal(body(blocked).error, 'too_many_attempts');

  // same address, valid user
  assert.equal((await analyzeAs('alice')).status, 200);
});

test('limits each user independently', async () => {
  for (let i = 0; i < LIMITS.userBurst.limit; i++) assert.equal((await analyzeAs('alice')).status, 200);
  const limited = await analyzeAs('alice');
  assert.equal(limited.status, 429);
  assert.equal(body(limited).error, 'rate_limited');
  assert.ok(Number(limited.headers['Retry-After']) >= 1);

  assert.equal((await analyzeAs('bob')).status, 200);
});

test('validates the body after authentication', async () => {
  const res = await analyzeAs('alice', { body: {} });
  assert.equal(res.status, 400);
  assert.equal(body(res).error, 'empty_input');
});

test('health reveals nothing to strangers and confirms a valid session', async () => {
  assert.deepEqual(body(await handleHealth({ headers: {}, env: ENV, deps: deps() })), { ok: true, configured: true, authorized: false });
  assert.deepEqual(body(await handleHealth({ headers: withToken('forged'), env: ENV, deps: deps() })), { ok: true, configured: true, authorized: false });
  assert.deepEqual(body(await handleHealth({ headers: withToken('alice'), env: ENV, deps: deps() })), { ok: true, configured: true, authorized: true });
  assert.deepEqual(body(await handleHealth({ headers: withToken('root'), env: ENV, deps: deps() })), { ok: true, configured: true, authorized: true });
  assert.deepEqual(body(await handleHealth({ headers: withToken('carol'), env: ENV, deps: deps() })), { ok: true, configured: true, authorized: false });
  assert.deepEqual(body(await handleHealth({ headers: withToken('alice'), env: {}, deps: deps() })), { ok: true, configured: false, authorized: false });
});

test('health throttles wrong tokens too', async () => {
  for (let i = 0; i < LIMITS.failures.limit; i++) await handleHealth({ headers: withToken('forged'), env: ENV, deps: deps() });
  assert.equal((await handleHealth({ headers: withToken('forged'), env: ENV, deps: deps() })).status, 429);
});

test('parseBody handles parsed, string and raw bodies', () => {
  assert.deepEqual(parseBody({ body: { a: 1 } }), { a: 1 });
  assert.deepEqual(parseBody({ body: '{"a":2}' }), { a: 2 });
  assert.deepEqual(parseBody({ rawBody: '{"a":3}' }), { a: 3 });
  assert.equal(parseBody({ rawBody: '{broken' }), null);
  assert.equal(parseBody({}), null);
});
