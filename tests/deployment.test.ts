import assert from 'node:assert/strict';
import { test } from 'node:test';

// Isolate these tests from deployment credentials and real booking data.
process.env.DOTENV_CONFIG_PATH = '__deployment_test_no_env__';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.SUPABASE_KEY;
delete process.env.VERCEL;
process.env.ADMIN_EMAIL = 'admin@test.invalid';
process.env.ADMIN_PASSWORD = 'test-only-password';
process.env.ADMIN_USERS = JSON.stringify([
  { email: 'partner@test.invalid', password: 'partner-test-password', name: 'Partner' },
]);

const { default: app } = await import('../api/index.ts');
const { StorageService } = await import('../server/services/supabase.ts');

test('Vercel API export handles authentication, revocation and unknown routes', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const unauthorized = await fetch(`${base}/api/requests`);
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.headers.get('cache-control'), 'no-store');
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.invalid', password: 'test-only-password' }),
    });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    assert.ok(token);
    const headers = { Authorization: `Bearer ${token}` };
    assert.equal((await fetch(`${base}/api/auth/me`, { headers })).status, 200);
    const partnerLogin = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ' PARTNER@test.invalid ', password: 'partner-test-password' }),
    });
    assert.equal(partnerLogin.status, 200);
    const partner = await partnerLogin.json();
    assert.deepEqual(partner.user, { email: 'partner@test.invalid', name: 'Partner', role: 'administrator' });
    assert.equal(JSON.stringify(partner).includes('partner-test-password'), false);
    const partnerHeaders = { Authorization: `Bearer ${partner.token}` };
    const partnerMe = await fetch(`${base}/api/auth/me`, { headers: partnerHeaders });
    assert.equal(partnerMe.status, 200);
    assert.deepEqual((await partnerMe.json()).user, partner.user);
    const wrongPassword = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'partner@test.invalid', password: 'test-only-password' }),
    });
    assert.equal(wrongPassword.status, 401);
    // Swapping the identity prefix must not transfer a valid session.
    const forged = partner.token.slice(0, -64) + token.slice(-64);
    assert.equal((await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${forged}` },
    })).status, 401);
    assert.equal((await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}tampered` },
    })).status, 401);
    assert.equal((await fetch(`${base}/api/auth/logout`, { method: 'POST', headers })).status, 200);
    assert.equal((await fetch(`${base}/api/auth/me`, { headers })).status, 401);
    assert.equal((await fetch(`${base}/api/auth/me`, { headers: partnerHeaders })).status, 200);
    const configuredUsers = process.env.ADMIN_USERS;
    process.env.ADMIN_USERS = '[]';
    try {
      assert.equal((await fetch(`${base}/api/auth/me`, { headers: partnerHeaders })).status, 401);
      assert.equal((await fetch(`${base}/api/requests`, { headers: partnerHeaders })).status, 401);
    } finally {
      process.env.ADMIN_USERS = configuredUsers;
    }
    assert.equal((await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: partnerHeaders })).status, 200);
    assert.equal((await fetch(`${base}/api/auth/me`, { headers: partnerHeaders })).status, 401);
    const unknown = await fetch(`${base}/api/not-found`);
    assert.equal(unknown.status, 404);
    assert.equal((await unknown.json()).success, false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('Vercel cannot silently fall back to local booking files', async () => {
  process.env.VERCEL = '1';
  try {
    await assert.rejects(StorageService.getAll(), /Booking storage unavailable/);
    await assert.rejects(StorageService.create({
      name: 'Test', phone: '1234567890', sport: 'Basketball', duration: 1,
    }), /Booking storage unavailable/);
  } finally {
    delete process.env.VERCEL;
  }
});
