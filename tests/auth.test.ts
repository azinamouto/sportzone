import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

process.env.DOTENV_CONFIG_PATH = '__auth_test_no_env__';
for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_KEY', 'SUPABASE_ANON_KEY', 'VERCEL']) delete process.env[key];
const { default: app } = await import('../server/app.ts');
const { Sessions } = await import('../server/services/sessions.ts');

test('login distinguishes credentials, configuration and session storage errors', async t => {
  const password = randomBytes(24).toString('hex');
  const partnerPassword = randomBytes(24).toString('hex');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const login = (email = 'owner@test.invalid', secret = password) => fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: secret }),
  });
  const configure = () => {
    process.env.ADMIN_EMAIL = ' OWNER@test.invalid ';
    process.env.ADMIN_PASSWORD = password;
    process.env.ADMIN_USERS = JSON.stringify([{ email: ' PARTNER@test.invalid ', password: partnerPassword }]);
  };
  try {
    configure();
    await t.test('both configured account sources log in and retain identity', async () => {
      for (const [email, secret] of [['owner@test.invalid', password], ['partner@test.invalid', partnerPassword]]) {
        const response = await login(email, secret);
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.user.email, email);
        assert.equal(JSON.stringify(body).includes(secret), false);
        const headers = { Authorization: `Bearer ${body.token}` };
        assert.equal((await fetch(`${base}/api/auth/me`, { headers })).status, 200);
        await fetch(`${base}/api/auth/logout`, { method: 'POST', headers });
      }
    });
    await t.test('wrong password and unknown email return 401 before session creation', async () => {
      const create = t.mock.method(Sessions, 'create', async () => { throw new Error('Must not be called'); });
      try {
        assert.equal((await login('owner@test.invalid', partnerPassword)).status, 401);
        assert.equal((await login('unknown@test.invalid')).status, 401);
        assert.equal(create.mock.callCount(), 0);
      } finally { create.mock.restore(); }
    });
    await t.test('missing configuration fails closed in development and production', async () => {
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_PASSWORD;
      delete process.env.ADMIN_USERS;
      const previous = process.env.NODE_ENV;
      try {
        for (const mode of ['development', 'production']) {
          process.env.NODE_ENV = mode;
          assert.equal((await login()).status, 503);
        }
      } finally {
        if (previous === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previous;
      }
    });
    await t.test('ADMIN_USERS works without the owner pair', async () => {
      process.env.ADMIN_USERS = JSON.stringify([{ email: 'partner@test.invalid', password: partnerPassword }]);
      assert.equal((await login('partner@test.invalid', partnerPassword)).status, 200);
    });
    await t.test('partial, malformed and duplicate configuration returns 503', async () => {
      configure();
      delete process.env.ADMIN_PASSWORD;
      assert.equal((await login()).status, 503);
      for (const users of ['{', '{}', '[{}]', JSON.stringify([{ email: 'owner@test.invalid', password }])]) {
        configure();
        process.env.ADMIN_USERS = users;
        assert.equal((await login()).status, 503);
      }
    });
    await t.test('Supabase session failure is not a credential 401 and issues no token', async () => {
      configure();
      const create = t.mock.method(Sessions, 'create', async () => { throw { status: 401, message: password }; });
      try {
        const response = await login();
        assert.equal(response.status, 503);
        const body = await response.json();
        assert.equal(body.token, undefined);
        assert.match(body.message, /session/);
        assert.equal(JSON.stringify(body).includes(password), false);
      } finally { create.mock.restore(); }
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('dotenv loads credentials before account reads and preserves deployment overrides', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sportszone-auth-'));
  const password = randomBytes(24).toString('hex');
  const envFile = join(directory, '.env');
  writeFileSync(envFile, `ADMIN_EMAIL=owner@test.invalid\nADMIN_PASSWORD=${password}\nADMIN_USERS=[]\n`);
  const env: NodeJS.ProcessEnv = { ...process.env, DOTENV_CONFIG_PATH: envFile };
  delete env.ADMIN_EMAIL;
  delete env.ADMIN_PASSWORD;
  delete env.ADMIN_USERS;
  try {
    for (const override of [false, true]) {
      const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        import { getAdminAccounts } from './server/services/adminAccounts.ts';
        const accounts = getAdminAccounts();
        assert.equal(accounts.length, 1);
        assert.equal(accounts[0].email, '${override ? 'override' : 'owner'}@test.invalid');
        assert.ok(accounts[0].password);
      `], { env: override ? { ...env, ADMIN_EMAIL: 'override@test.invalid' } : env, encoding: 'utf8' });
      assert.equal(result.status, 0, 'Isolated dotenv initialization failed');
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
