import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import type { BookingRequest } from '../server/types/booking.ts';

process.env.DOTENV_CONFIG_PATH = '__receipt_test_no_env__';
delete process.env.SUPABASE_URL;
process.env.ADMIN_EMAIL = 'receipt-admin@test.invalid';
process.env.ADMIN_PASSWORD = 'receipt-test-password';
delete process.env.ADMIN_USERS;
delete process.env.VERCEL;

const { default: app } = await import('../server/app.ts');
const { BookingRequestModel: Model } = await import('../server/models/BookingRequest.ts');

test('private receipts follow admin decisions without exposing customer or admin data', async () => {
  const originals = { create: Model.create, find: Model.find, update: Model.update };
  const records = new Map<string, BookingRequest>();
  Model.create = async dto => {
    const record: BookingRequest = {
      ...dto, id: `SZ-TEST-${records.size}`, duration: 1, status: 'pending',
      admin_notes: 'Private internal note', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    records.set(record.id, record);
    return record;
  };
  Model.find = async id => records.get(id) || null;
  Model.update = async (id, updates) => {
    const record = records.get(id);
    if (!record) return null;
    Object.assign(record, updates);
    return record;
  };
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const jsonHeaders = { 'Content-Type': 'application/json' };
  try {
    const submit = () => fetch(`${base}/requests`, {
      method: 'POST', headers: jsonHeaders,
      body: JSON.stringify({ name: 'Customer', phone: '09123456789', email: 'customer@test.invalid',
        sport: 'Basketball', message: 'Private customer message', tracking_token_hash: 'forged' }),
    });
    const created = await submit();
    assert.equal(created.status, 201);
    const { data, tracking_token: token } = await created.json();
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(data.tracking_token_hash, undefined);
    assert.equal(records.get(data.id)?.tracking_token_hash, createHash('sha256').update(token).digest('hex'));
    const other = await (await submit()).json();
    assert.notEqual(token, other.tracking_token);
    const url = `${base}/requests/${data.id}/receipt`;
    const headers = { 'X-Receipt-Token': token };
    for (const invalid of ['', 'bad', '0'.repeat(64), other.tracking_token]) {
      assert.equal((await fetch(url, { headers: { 'X-Receipt-Token': invalid } })).status, 404);
    }
    const receipt = await fetch(url, { headers });
    assert.equal(receipt.status, 200);
    assert.equal(receipt.headers.get('cache-control'), 'no-store');
    const publicData = (await receipt.json()).data;
    assert.equal(publicData.status, 'pending');
    for (const privateField of ['name', 'phone', 'email', 'message', 'admin_notes', 'tracking_token_hash']) {
      assert.equal(privateField in publicData, false);
    }
    assert.equal((await fetch(`${base}/requests/${data.id}`, { headers })).status, 401);
    assert.equal((await fetch(`${base}/requests/${data.id}`, { method: 'PATCH', headers: { ...headers, ...jsonHeaders }, body: '{"status":"confirmed"}' })).status, 401);
    const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: jsonHeaders,
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) });
    const admin = await login.json();
    for (const status of ['confirmed', 'rejected', 'completed', 'pending']) {
      const updated = await fetch(`${base}/requests/${data.id}`, {
        method: 'PATCH', headers: { ...jsonHeaders, Authorization: `Bearer ${admin.token}` },
        body: JSON.stringify({ status, court_assigned: 'Court 1', admin_notes: 'Still private' }),
      });
      assert.equal(updated.status, 200);
      const current = (await (await fetch(url, { headers })).json()).data;
      assert.equal(current.status, status);
      assert.equal(current.court_assigned, 'Court 1');
      assert.equal(current.admin_notes, undefined);
    }
    Model.find = async () => { throw new Error('Storage offline'); };
    assert.equal((await fetch(url, { headers })).status, 503);
    Model.find = async () => null;
    assert.equal((await fetch(url, { headers })).status, 404);
    Model.find = async () => ({ ...data, tracking_token_hash: undefined });
    assert.equal((await fetch(url, { headers })).status, 404);
    Model.create = async () => { throw new Error('Storage offline'); };
    const failed = await submit();
    assert.equal(failed.status, 500);
    assert.equal((await failed.json()).tracking_token, undefined);
  } finally {
    Object.assign(Model, originals);
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
