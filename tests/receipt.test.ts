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

test('private payment preferences persist without changing booking or payment status', async () => {
  const originalFind = Model.find;
  const originalUpdate = Model.update;
  const token = 'a'.repeat(64);
  const record: BookingRequest = {
    id: 'SZ-PAYMENT-TEST', name: 'Payment Test', phone: '09171234567', sport: 'Basketball',
    duration: 1, status: 'pending', admin_notes: 'Private note', created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(), tracking_token_hash: createHash('sha256').update(token).digest('hex'),
  };
  let writes = 0;
  Model.find = async id => id === record.id ? record : null;
  Model.update = async (id, updates) => {
    assert.equal(id, record.id);
    assert.deepEqual(Object.keys(updates), ['payment_method']);
    writes++;
    Object.assign(record, updates);
    return record;
  };
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/requests/${record.id}`;
  const save = (method: unknown, credential = token) => fetch(`${base}/payment-method`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Receipt-Token': credential },
    body: JSON.stringify({ payment_method: method, status: 'confirmed', admin_notes: 'forged', payment_status: 'paid' }),
  });
  try {
    for (const credential of ['', 'bad', 'b'.repeat(64)]) assert.equal((await save('cash', credential)).status, 404);
    for (const method of ['', 'crypto', 'constructor', '__proto__', null, 1]) assert.equal((await save(method)).status, 422);
    assert.equal(writes, 0);
    for (const method of ['cash', 'card', 'gcash', 'other']) {
      const response = await save(method);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const result = await response.json();
      assert.equal(result.data.payment_method, method);
      assert.deepEqual(Object.keys(result.data).sort(), ['id', 'payment_method', 'updated_at']);
      const receipt = await (await fetch(`${base}/receipt`, { headers: { 'X-Receipt-Token': token } })).json();
      assert.equal(receipt.data.payment_method, method);
      assert.equal(record.status, 'pending');
      assert.equal(record.admin_notes, 'Private note');
      assert.equal('payment_status' in record, false);
    }
    for (const status of ['completed', 'rejected'] as const) {
      record.status = status;
      assert.equal((await save('cash')).status, 409);
    }
    record.status = 'confirmed';
    assert.equal((await save('cash')).status, 200);
    Model.update = async () => { throw new Error('Test storage unavailable'); };
    assert.equal((await save('card')).status, 503);
    assert.equal(record.payment_method, 'cash');
    record.tracking_token_hash = undefined;
    assert.equal((await save('card')).status, 404);
  } finally {
    Model.find = originalFind;
    Model.update = originalUpdate;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

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
    const submit = (phone: unknown = '09171234567') => fetch(`${base}/requests`, {
      method: 'POST', headers: jsonHeaders,
      body: JSON.stringify({ name: 'Customer', phone, email: 'customer@test.invalid',
        sport: 'Basketball', message: 'Private customer message', tracking_token_hash: 'forged' }),
    });
    for (const invalid of ['', '0917123456', '091712345678', '0917123456a', '+9171234567', '0917 1234567', '091712345.7', '09171234567\n', 9171234567, null]) {
      const rejected = await submit(invalid);
      assert.equal(rejected.status, 422);
      assert.deepEqual((await rejected.json()).errors.phone, ['The contact number must contain exactly 11 digits.']);
    }
    assert.equal(records.size, 0, 'Invalid phone numbers must not reach storage');
    const created = await submit();
    assert.equal(created.status, 201);
    const { data, tracking_token: token } = await created.json();
    assert.equal(data.phone, '09171234567', 'Leading zeroes must be preserved');
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
