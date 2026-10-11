'use strict';

const { clientIp, hit, LIMITS } = require('./security');
const { verifyIdToken, AuthError } = require('./firebase-auth');
const { validateRequest, analyze } = require('./analyze');

// Static Web Apps replaces the standard Authorization header before it reaches the API, so the Firebase ID token
// travels in a custom header instead.
const TOKEN_HEADER = 'x-firebase-token';

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(status, body, headers = {}) {
  return { status, headers: { ...BASE_HEADERS, ...headers }, body: JSON.stringify(body) };
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = typeof req.body === 'string' ? req.body : req.rawBody;
  if (typeof raw !== 'string' || !raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const isConfigured = (env) => Boolean(env.GEMINI_API_KEY && env.FIREBASE_PROJECT_ID);

function allowedEmails(env) {
  return new Set(
    String(env.ALLOWED_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function verifier(env, deps) {
  if (deps?.verifyToken) return deps.verifyToken;
  return (token) => verifyIdToken(token, { projectId: env.FIREBASE_PROJECT_ID, fetchImpl: deps?.fetchImpl, now: deps?.now });
}

const tooManyAttempts = () => json(429, { error: 'too_many_attempts' }, { 'Retry-After': '600' });

/**
 * Valid sessions are never throttled by the failure counter: it only counts requests that failed authentication,
 * so a stranger can't lock the owner out.
 */
async function authenticate({ headers, env, deps }) {
  if (!isConfigured(env)) return { response: json(503, { error: 'not_configured' }) };

  const token = headers[TOKEN_HEADER];
  const ip = clientIp(headers);

  let user;
  try {
    if (typeof token !== 'string' || !token) throw new AuthError('missing_token');
    user = await verifier(env, deps)(token);
  } catch (err) {
    if (err instanceof AuthError && err.code === 'keys_unavailable') return { response: json(503, { error: 'auth_unavailable' }) };
    if (!hit(`fail:${ip}`, LIMITS.failures).ok) return { response: tooManyAttempts() };
    return { response: json(401, { error: 'unauthorized' }) };
  }

  if (!user.emailVerified) return { response: json(403, { error: 'email_not_verified' }) };

  const allowed = allowedEmails(env);
  if (allowed.size > 0 && !allowed.has(String(user.email || '').toLowerCase())) return { response: json(403, { error: 'not_allowed' }) };

  return { user };
}

async function handleAnalyze({ method, headers, body, env, log, deps }) {
  if (method && method.toUpperCase() !== 'POST') {
    return json(405, { error: 'method_not_allowed' }, { Allow: 'POST' });
  }

  const auth = await authenticate({ headers, env, deps });
  if (auth.response) return auth.response;

  for (const limit of [LIMITS.userBurst, LIMITS.userDaily]) {
    const rate = hit(`${limit.windowMs}:${auth.user.uid}`, limit);
    if (!rate.ok) return json(429, { error: 'rate_limited' }, { 'Retry-After': String(rate.retryAfter) });
  }

  const parsed = validateRequest(body);
  if (!parsed.ok) return json(parsed.status, { error: parsed.error, message: parsed.message });

  const result = await analyze(parsed.value, env, { log, ...deps });
  return json(result.status, result.body);
}

async function handleHealth({ headers, env, deps }) {
  const configured = isConfigured(env);
  let authorized = false;

  if (configured && typeof headers[TOKEN_HEADER] === 'string' && headers[TOKEN_HEADER]) {
    const auth = await authenticate({ headers, env, deps });
    if (auth.response?.status === 429) return auth.response;
    authorized = Boolean(auth.user);
  }

  return json(200, { ok: true, configured, authorized });
}

module.exports = { handleAnalyze, handleHealth, parseBody, json, TOKEN_HEADER };
