import { execSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WRANGLER_TOML = path.join(ROOT, 'wrangler.toml');
const SEED_SQL = path.join(ROOT, 'migrations', '0002_seed_2569.sql');
const PROJECT_NAME = (process.env.CF_PAGES_PROJECT || 'rkk-ac-maintenance').trim();
const DB_NAME = (process.env.CF_D1_NAME || 'rkk-ac-db').trim();
const FORCE_REGEN_SEED = process.argv.includes('--regen-seed');

function run(cmd, args, { allowFail = false, extraEnv = {} } = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  });
  if (res.status !== 0 && !allowFail) {
    process.exit(res.status ?? 1);
  }
  return res.status ?? 1;
}

function runCapture(cmd, args, { extraEnv = {} } = {}) {
  return spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  });
}

function runAndStreamCapture(cmd, args, { extraEnv = {} } = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      shell: process.platform === 'win32',
      env: { ...process.env, ...extraEnv },
    });
    let combined = '';
    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      combined += text;
      process.stdout.write(text);
    });
    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      combined += text;
      process.stderr.write(text);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ status: code ?? 1, output: combined });
    });
  });
}

function ensureAuth() {
  const whoami = runCapture('npx', ['--yes', 'wrangler', 'whoami']);
  const output = `${whoami.stdout || ''}\n${whoami.stderr || ''}`;
  const isAuthed = whoami.status === 0 && !/not authenticated/i.test(output);

  if (process.env.CLOUDFLARE_API_TOKEN) {
    if (!isAuthed) {
      console.error('CLOUDFLARE_API_TOKEN is set, but Wrangler authentication failed:\n', output);
      process.exit(1);
    }
    console.log('Authenticated with Cloudflare via CLOUDFLARE_API_TOKEN.');
    return;
  }

  if (isAuthed) {
    console.log('Cloudflare Wrangler session is already authenticated.');
    return;
  }

  if (process.env.CI) {
    console.error(
      'Running in CI without Cloudflare authentication. Please set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.'
    );
    process.exit(1);
  }

  console.log('Opening browser to log in to Cloudflare via Wrangler...');
  run('npx', ['--yes', 'wrangler', 'login']);
}

function findD1DatabaseUuid() {
  const listed = runCapture('npx', ['--yes', 'wrangler', 'd1', 'list', '--json']);
  if (listed.status !== 0) return null;
  try {
    const parsed = JSON.parse(listed.stdout || '[]');
    if (Array.isArray(parsed)) {
      const match = parsed.find((item) => item?.name === DB_NAME);
      if (match?.uuid) return String(match.uuid);
    }
  } catch {
    // fallback below
  }
  return null;
}

function ensureD1Database() {
  if (!fs.existsSync(WRANGLER_TOML)) {
    throw new Error('wrangler.toml not found in project root');
  }

  let dbUuid = findD1DatabaseUuid();
  if (!dbUuid) {
    console.log(`Creating Cloudflare D1 database "${DB_NAME}"...`);
    const created = runCapture('npx', ['--yes', 'wrangler', 'd1', 'create', DB_NAME]);
    const combined = `${created.stdout || ''}\n${created.stderr || ''}`;
    console.log(combined);
    const uuidMatch = combined.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    dbUuid = uuidMatch?.[0] || findD1DatabaseUuid();
    if (!dbUuid) {
      throw new Error(`Could not create or locate D1 database "${DB_NAME}".`);
    }
  } else {
    console.log(`Found existing D1 database "${DB_NAME}" (uuid: ${dbUuid}).`);
  }

  let toml = fs.readFileSync(WRANGLER_TOML, 'utf8');
  const nextToml = toml
    .replace(/^name\s*=\s*"[^"]*"/m, `name = "${PROJECT_NAME}"`)
    .replace(/database_name\s*=\s*"[^"]*"/, `database_name = "${DB_NAME}"`)
    .replace(/database_id\s*=\s*"[^"]*"/, `database_id = "${dbUuid}"`);

  if (nextToml !== toml) {
    fs.writeFileSync(WRANGLER_TOML, nextToml, 'utf8');
    console.log(`Synced wrangler.toml (project="${PROJECT_NAME}", db="${DB_NAME}", uuid="${dbUuid}").`);
  }
}

async function verifyDeployment(deployUrl) {
  if (!deployUrl) return;
  console.log(`\n[6/6] Verifying live Cloudflare Pages + D1 at ${deployUrl}...`);
  await new Promise((r) => setTimeout(r, 2500));

  for (const endpoint of ['/api/health', '/api/public/company']) {
    try {
      const res = await fetch(`${deployUrl}${endpoint}`);
      const text = await res.text();
      if (!res.ok) {
        console.warn(`Warning: ${endpoint} returned HTTP ${res.status}: ${text}`);
      } else {
        console.log(`OK ${endpoint} -> ${text.slice(0, 220)}`);
      }
    } catch (err) {
      console.warn(`Warning: failed to reach ${deployUrl}${endpoint}:`, err.message);
    }
  }
}

async function main() {
  console.log('=== Auto-Deploy: Cloudflare D1 + Cloudflare Pages ===');
  ensureAuth();
  ensureD1Database();

  console.log('\n[1/5] Checking D1 seed migration...');
  if (FORCE_REGEN_SEED || !fs.existsSync(SEED_SQL)) {
    execSync('npm run d1:seed-gen', { stdio: 'inherit' });
  } else {
    console.log('Using existing migrations/0002_seed_2569.sql (pass --regen-seed to regenerate).');
  }

  console.log('\n[2/5] Applying Cloudflare D1 migrations (--remote)...');
  run('npx', ['--yes', 'wrangler', 'd1', 'migrations', 'apply', DB_NAME, '--remote'], {
    extraEnv: { CI: 'true' },
  });

  console.log(`\n[3/5] Ensuring Cloudflare Pages project "${PROJECT_NAME}" exists...`);
  run(
    'npx',
    ['--yes', 'wrangler', 'pages', 'project', 'create', PROJECT_NAME, '--production-branch=main'],
    { allowFail: true, extraEnv: { CI: 'true' } }
  );

  console.log('\n[4/5] Building frontend...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('\n[5/5] Deploying to Cloudflare Pages...');
  const deployRes = await runAndStreamCapture(
    'npx',
    [
      '--yes',
      'wrangler',
      'pages',
      'deploy',
      'dist',
      `--project-name=${PROJECT_NAME}`,
      '--branch=main',
      '--commit-dirty=true',
    ],
    { extraEnv: { CI: 'true' } }
  );

  if (deployRes.status !== 0) {
    process.exit(deployRes.status);
  }

  const urlMatch = deployRes.output.match(/https:\/\/[a-z0-9.-]+\.pages\.dev\b/i);
  const deployUrl = urlMatch?.[0] || `https://${PROJECT_NAME}.pages.dev`;
  await verifyDeployment(deployUrl);

  console.log('\n=== Deployment Complete! ===');
  console.log(`Live URL: https://${PROJECT_NAME}.pages.dev`);
}

main().catch((err) => {
  console.error('Auto-deploy failed:', err);
  process.exit(1);
});
