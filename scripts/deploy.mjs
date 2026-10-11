// Builds the app and publishes the frontend + AI API to Azure Static Web Apps (Free plan).
//   npm run deploy                 build and deploy
//   npm run deploy -- --settings   also push the API settings (see below) from .env.local / .env to the app
// Requires `az login`. The Firebase web config comes from .env at build time, exactly like `npm run build`.
// Secrets are never printed.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = process.env.SWA_NAME || 'swa-calorie-tracker';
const RESOURCE_GROUP = process.env.SWA_RESOURCE_GROUP || 'rg-calorie-tracker';
const OUTPUT = 'dist/gym-attendance-tracker/browser';

// Settings read by the API (api/lib). GEMINI_MODELS is optional. Who may use the AI is managed in the app, not here.
const API_SETTINGS = ['GEMINI_API_KEY', 'FIREBASE_PROJECT_ID', 'GEMINI_MODELS'];

function run(command, args, env = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: root, env: { ...process.env, ...env } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function az(args) {
  return execFileSync('az', args, { encoding: 'utf8', cwd: root }).trim();
}

function readEnv(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !line.trim().startsWith('#')) values[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return values;
}

if (process.argv.includes('--settings')) {
  const env = { ...readEnv(path.join(root, '.env')), ...readEnv(path.join(root, '.env.local')) };
  if (!env.GEMINI_API_KEY || !env.FIREBASE_PROJECT_ID) {
    console.error('GEMINI_API_KEY (.env.local) and FIREBASE_PROJECT_ID (.env) must be set');
    process.exit(1);
  }
  const pairs = API_SETTINGS.filter((key) => env[key]).map((key) => `${key}=${env[key]}`);
  az(['staticwebapp', 'appsettings', 'set', '--name', APP, '--resource-group', RESOURCE_GROUP, '--setting-names', ...pairs, '-o', 'none']);
  console.log(`App settings updated: ${pairs.map((p) => p.split('=')[0]).join(', ')}`);
}

run('npm', ['run', 'build']);

const token = az(['staticwebapp', 'secrets', 'list', '--name', APP, '--resource-group', RESOURCE_GROUP, '--query', 'properties.apiKey', '-o', 'tsv']);
run(
  'npx',
  ['-y', '@azure/static-web-apps-cli@latest', 'deploy', OUTPUT, '--api-location', 'api', '--api-language', 'node', '--api-version', '22', '--env', 'production'],
  { SWA_CLI_DEPLOYMENT_TOKEN: token },
);

const host = az(['staticwebapp', 'show', '--name', APP, '--resource-group', RESOURCE_GROUP, '--query', 'defaultHostname', '-o', 'tsv']);
console.log(`\nLive at https://${host}`);
