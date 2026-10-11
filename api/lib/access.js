'use strict';

// Who may use the calorie tracker is decided by the admin in the app and stored in Firestore (collection
// `nutritionAccess`, one document per account). The server reads the signed-in user's own entry with that user's own
// ID token, so Firestore's security rules decide what can be read and no service account is needed here.

const COLLECTION = 'nutritionAccess';
const TIMEOUT_MS = 5000;
// Decisions are remembered briefly so a user can't turn the API into a Firestore read loop. Switching someone off
// therefore takes effect within TTL_ALLOWED_MS; switching someone on within TTL_DENIED_MS.
const TTL_ALLOWED_MS = 30_000;
const TTL_DENIED_MS = 10_000;
const MAX_ENTRIES = 1000;

class AccessError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AccessError';
    this.code = code;
  }
}

const decisions = new Map();

function resetAccessCache() {
  decisions.clear();
}

function remember(uid, allowed, now) {
  if (decisions.size >= MAX_ENTRIES) {
    for (const [key, entry] of decisions) if (entry.expiresAt <= now) decisions.delete(key);
    if (decisions.size >= MAX_ENTRIES) decisions.clear();
  }
  decisions.set(uid, { allowed, expiresAt: now + (allowed ? TTL_ALLOWED_MS : TTL_DENIED_MS) });
}

// FIRESTORE_EMULATOR_HOST is the standard variable of the Firebase emulators; it is never set on Azure.
const origin = (env) => (env.FIRESTORE_EMULATOR_HOST ? `http://${env.FIRESTORE_EMULATOR_HOST}` : 'https://firestore.googleapis.com');

/**
 * Resolves true only when the user's entry exists and has `enabled: true`.
 * A missing entry or a refusal by the security rules means "no access". A rejected token throws
 * AccessError('unauthorized'); anything else (network, outage) throws AccessError('unavailable'), so callers can fail
 * closed with a retryable error. Errors are never remembered.
 */
async function hasNutritionAccess({ uid, idToken, env, fetchImpl = globalThis.fetch, now = Date.now }) {
  const cached = decisions.get(uid);
  if (cached && cached.expiresAt > now()) return cached.allowed;

  const url = `${origin(env)}/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/${COLLECTION}/${encodeURIComponent(uid)}`;
  let res;
  try {
    res = await fetchImpl(url, { headers: { Authorization: `Bearer ${idToken}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new AccessError('unavailable');
  }

  if (res.status === 401) throw new AccessError('unauthorized');
  let allowed = false;
  if (res.status === 200) {
    let doc;
    try {
      doc = await res.json();
    } catch {
      throw new AccessError('unavailable');
    }
    allowed = doc?.fields?.enabled?.booleanValue === true;
  } else if (res.status !== 404 && res.status !== 403) {
    throw new AccessError('unavailable');
  }

  remember(uid, allowed, now());
  return allowed;
}

module.exports = { hasNutritionAccess, AccessError, resetAccessCache, COLLECTION, TTL_ALLOWED_MS, TTL_DENIED_MS };
