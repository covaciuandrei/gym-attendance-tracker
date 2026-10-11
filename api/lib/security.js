'use strict';

function clientIp(headers) {
  const raw = headers['x-azure-clientip'] || (headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
  return String(raw).trim().replace(/:\d+$/, '') || 'unknown';
}

// Best-effort sliding windows kept in memory. Instances are short lived, which is fine for a small personal app.
const windows = new Map();
const MAX_KEYS = 2000;

function sweep(now) {
  for (const [key, entry] of windows) {
    if (entry.times.every((t) => now - t >= entry.windowMs)) windows.delete(key);
  }
}

function hit(key, { limit, windowMs, now = Date.now() }) {
  if (windows.size > MAX_KEYS) sweep(now);

  const entry = windows.get(key) || { times: [], windowMs };
  entry.windowMs = windowMs;
  entry.times = entry.times.filter((t) => now - t < windowMs);

  if (entry.times.length >= limit) {
    windows.set(key, entry);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - entry.times[0])) / 1000)) };
  }
  entry.times.push(now);
  windows.set(key, entry);
  return { ok: true, retryAfter: 0 };
}

function resetLimits() {
  windows.clear();
}

const LIMITS = {
  // Per signed-in user: a burst allowance and a daily ceiling.
  userBurst: { limit: 30, windowMs: 10 * 60 * 1000 },
  userDaily: { limit: 200, windowMs: 24 * 60 * 60 * 1000 },
  // Per address, only for requests that fail authentication.
  failures: { limit: 10, windowMs: 10 * 60 * 1000 },
};

module.exports = { clientIp, hit, resetLimits, LIMITS };
