'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { hasNutritionAccess, AccessError, resetAccessCache, TTL_ALLOWED_MS, TTL_DENIED_MS } = require('../lib/access');

const ENV = { FIREBASE_PROJECT_ID: 'demo-project' };
const docWith = (enabled) => ({ name: 'projects/demo-project/databases/(default)/documents/nutritionAccess/alice', fields: { enabled: { booleanValue: enabled } } });

/** A fake Firestore REST endpoint that records what it was asked. */
function firestore(respond) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return respond(url, init);
  };
  impl.calls = calls;
  return impl;
}
const reply = (status, body) => async () => ({ status, json: async () => body });

let clock = 1_000_000;
const now = () => clock;
const check = (extra = {}) => hasNutritionAccess({ uid: 'alice', idToken: 'alice-token', env: ENV, now, ...extra });
const rejectsWith = (promise, code) => assert.rejects(promise, (err) => err instanceof AccessError && err.code === code, `expected ${code}`);

test.beforeEach(() => {
  resetAccessCache();
  clock = 1_000_000;
});

test('reads the entry of the signed-in user with that user\'s own token', async () => {
  const fetchImpl = firestore(reply(200, docWith(true)));
  assert.equal(await check({ fetchImpl }), true);

  assert.equal(fetchImpl.calls.length, 1);
  const { url, init } = fetchImpl.calls[0];
  assert.equal(url, 'https://firestore.googleapis.com/v1/projects/demo-project/databases/(default)/documents/nutritionAccess/alice');
  assert.equal(init.headers.Authorization, 'Bearer alice-token');
  assert.ok(init.signal, 'requests must have a timeout');
});

test('only an explicit enabled: true grants access', async () => {
  const outcomes = [
    [200, docWith(false), false],
    [200, { fields: {} }, false],
    [200, { fields: { enabled: { stringValue: 'true' } } }, false],
    [200, { fields: { enabled: { integerValue: '1' } } }, false],
    [404, { error: { status: 'NOT_FOUND' } }, false],
    [403, { error: { status: 'PERMISSION_DENIED' } }, false],
  ];
  for (const [status, body, expected] of outcomes) {
    resetAccessCache();
    assert.equal(await check({ fetchImpl: firestore(reply(status, body)) }), expected, `${status} ${JSON.stringify(body)}`);
  }
});

test('outages are reported as unavailable, a rejected token as unauthorized, and neither is remembered', async () => {
  for (const status of [400, 429, 500, 503]) {
    await rejectsWith(check({ fetchImpl: firestore(reply(status, {})) }), 'unavailable');
  }
  await rejectsWith(check({ fetchImpl: firestore(async () => { throw new TypeError('fetch failed'); }) }), 'unavailable');
  await rejectsWith(check({ fetchImpl: firestore(async () => ({ status: 200, json: async () => { throw new SyntaxError('bad json'); } })) }), 'unavailable');
  await rejectsWith(check({ fetchImpl: firestore(reply(401, {})) }), 'unauthorized');

  // after all those failures a healthy answer is used straight away
  assert.equal(await check({ fetchImpl: firestore(reply(200, docWith(true))) }), true);
});

test('remembers decisions briefly so a user cannot turn the API into a read loop', async () => {
  const fetchImpl = firestore(reply(200, docWith(true)));
  for (let i = 0; i < 20; i++) assert.equal(await check({ fetchImpl }), true);
  assert.equal(fetchImpl.calls.length, 1);

  clock += TTL_ALLOWED_MS - 1;
  await check({ fetchImpl });
  assert.equal(fetchImpl.calls.length, 1);
  clock += 1;
  await check({ fetchImpl });
  assert.equal(fetchImpl.calls.length, 2);
});

test('a refusal is remembered for a shorter time, so a newly enabled user is not kept waiting', async () => {
  let enabled = false;
  const fetchImpl = firestore(async () => ({ status: 200, json: async () => docWith(enabled) }));

  assert.equal(await check({ fetchImpl }), false);
  enabled = true;
  assert.equal(await check({ fetchImpl }), false);
  assert.equal(fetchImpl.calls.length, 1);

  clock += TTL_DENIED_MS;
  assert.equal(await check({ fetchImpl }), true);
  assert.equal(fetchImpl.calls.length, 2);
  assert.ok(TTL_DENIED_MS < TTL_ALLOWED_MS);
});

test('a switch that is turned off is noticed once the remembered answer expires', async () => {
  let enabled = true;
  const fetchImpl = firestore(async () => ({ status: 200, json: async () => docWith(enabled) }));
  assert.equal(await check({ fetchImpl }), true);
  enabled = false;
  clock += TTL_ALLOWED_MS;
  assert.equal(await check({ fetchImpl }), false);
});

test('accounts are decided independently', async () => {
  const fetchImpl = firestore(async (url) => (url.endsWith('/alice') ? { status: 200, json: async () => docWith(true) } : { status: 404, json: async () => ({}) }));
  assert.equal(await check({ fetchImpl }), true);
  assert.equal(await hasNutritionAccess({ uid: 'bob', idToken: 'bob-token', env: ENV, now, fetchImpl }), false);
  assert.equal(await check({ fetchImpl }), true);
  assert.equal(fetchImpl.calls.length, 2);
});

test('encodes the account id and targets the emulator when the standard emulator variable is set', async () => {
  const fetchImpl = firestore(reply(404, {}));
  await hasNutritionAccess({ uid: 'a/b c', idToken: 't', env: { ...ENV, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }, now, fetchImpl });
  assert.equal(fetchImpl.calls[0].url, 'http://127.0.0.1:8080/v1/projects/demo-project/databases/(default)/documents/nutritionAccess/a%2Fb%20c');
});
