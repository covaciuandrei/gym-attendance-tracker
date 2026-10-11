// Local stand-in for the Azure Static Web Apps managed API.
// It runs the real function code on http://localhost:7071; `ng serve` proxies /api to it (see proxy.conf.json).
//
//   npm run dev:api                 verifies real Firebase ID tokens (sign in with your real account)
//   npm run dev:api -- --emulator   trusts the unsigned tokens of the local Firebase Auth emulator (testing only)
//
// Reads GEMINI_API_KEY (and FIREBASE_PROJECT_ID) from .env.local / .env. Neither file is ever committed.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { handleAnalyze, handleHealth, parseBody } = require(path.join(root, 'api/lib/handlers.js'));
const { AuthError } = require(path.join(root, 'api/lib/firebase-auth.js'));

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trim().startsWith('#')) continue;
    process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv(path.join(root, '.env.local'));
loadEnv(path.join(root, '.env'));

const emulator = process.argv.includes('--emulator');
if (emulator) process.env.FIREBASE_PROJECT_ID = process.env.EMULATOR_PROJECT_ID || 'demo-gym';

/** The Auth emulator signs nothing, so its tokens can only be decoded, never verified. */
function emulatorVerifier(projectId) {
  return async (token) => {
    let claims;
    try {
      claims = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
    } catch {
      throw new AuthError('malformed');
    }
    if (claims.aud !== projectId) throw new AuthError('bad_audience');
    if (!(claims.exp * 1000 > Date.now())) throw new AuthError('expired');
    return { uid: claims.user_id || claims.sub, email: claims.email ?? null, emailVerified: claims.email_verified === true, admin: claims.admin === true };
  };
}

// The access switches live in Firestore; with the emulator the API reads them from the Firestore emulator.
if (emulator) process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';

const deps = emulator ? { verifyToken: emulatorVerifier(process.env.FIREBASE_PROJECT_ID) } : {};
const log = Object.assign((...args) => console.log('[api]', ...args), { warn: console.warn, error: console.error });
const MAX_BODY = 6 * 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = `${req.method} ${url.pathname}`;
  if (route !== 'POST /api/analyze' && route !== 'GET /api/health') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
    return;
  }

  try {
    const rawBody = req.method === 'POST' ? await readBody(req) : '';
    const common = { method: req.method, headers: req.headers, env: process.env, deps };
    const out =
      route === 'POST /api/analyze'
        ? await handleAnalyze({ ...common, body: parseBody({ rawBody }), log })
        : await handleHealth(common);
    res.writeHead(out.status, out.headers);
    res.end(out.body);
  } catch (err) {
    console.error('[api] error', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'server_error' }));
  }
});

const port = Number(process.env.API_PORT || 7071);
server.listen(port, () => {
  const configured = Boolean(process.env.GEMINI_API_KEY && process.env.FIREBASE_PROJECT_ID);
  console.log(`Dev API on http://localhost:${port}  (configured: ${configured}, ${emulator ? 'Auth emulator tokens' : 'real Firebase tokens'})`);
});
