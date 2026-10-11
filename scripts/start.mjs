// `npm start`: runs the Angular dev server together with the local stand-in for the AI API, so "Estimate with AI"
// works without a second terminal. Extra arguments go to `ng serve` (npm start -- --port 4300).
// `npm run dev:api` still runs the API on its own.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ngCli = path.join(root, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
const devApi = path.join(root, 'scripts', 'dev-api.mjs');

const run = (script, args = []) => spawn(process.execPath, [script, ...args], { cwd: root, stdio: 'inherit' });

const server = run(ngCli, ['serve', ...process.argv.slice(2)]);
const api = run(devApi);

// The app is still usable without the API (meals can be logged by hand), so the dev server keeps running if the
// API stops, for example because another copy of it already owns the port.
api.on('exit', (code) => {
  if (code) console.warn(`[api] stopped (exit code ${code}). The AI estimate won't work until it runs again: npm run dev:api`);
});

const stop = () => {
  api.kill();
  server.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

server.on('exit', (code) => {
  api.kill();
  process.exit(code ?? 0);
});
