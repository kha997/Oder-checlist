#!/usr/bin/env node
/**
 * Firestore security rules verification.
 *
 * Runs real requests against the Firestore emulator and asserts that
 * firestore.rules allow/deny exactly what they claim. No extra dependencies:
 * the emulator decodes (and does not verify the signature of) JWTs, so we
 * forge tokens carrying the claims we want to exercise.
 *
 * Intended usage:
 *   npx firebase-tools emulators:exec --only firestore \
 *     --project demo-oder-checklist "node scripts/verify-firestore-rules.mjs"
 *
 * Env:
 *   FIRESTORE_EMULATOR_HOST  default 127.0.0.1:8080
 *   FIRESTORE_RULES_PROJECT  default demo-oder-checklist
 */

const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const PROJECT = process.env.FIRESTORE_RULES_PROJECT ?? 'demo-oder-checklist';
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** Forge an unsigned JWT carrying arbitrary identity claims. */
function tokenFor(identity) {
  const { uid, email, emailVerified = true } = identity ?? {};
  if (!uid) return null; // signed out
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({
    sub: uid,
    aud: PROJECT,
    iat: 0,
    exp: 4102444800, // 2100-01-01
    ...(email ? { email, email_verified: emailVerified } : {}),
  });
  return `${header}.${payload}.`;
}

const ANON = tokenFor(null);
const VERIFIED = tokenFor({ uid: 'u-verified', email: 'shipper@example.com' });
const UNVERIFIED = tokenFor({ uid: 'u-unverified', email: 'spam@example.com', emailVerified: false });
const ADMIN = tokenFor({ uid: 'u-admin', email: 'khafibo@gmail.com' });
const ADMIN_BY_DOC = tokenFor({ uid: 'u-admin-doc', email: 'other@example.com' });

async function request(method, coll, id, data, token) {
  const url = `${BASE}/${coll}/${id}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(data ? { body: JSON.stringify({ fields: toFields(data) }) } : {}),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* ignore non-JSON */
  }
  return { status: res.status, body };
}

const toFields = (data) =>
  Object.fromEntries(
    Object.entries(data)
      .filter(([, v]) => v !== undefined) // mirror the app's sanitizeForFirestore()
      .map(([k, v]) => [
        k,
        typeof v === 'number'
          ? Number.isInteger(v)
            ? { integerValue: String(v) }
            : { doubleValue: v }
          : { stringValue: String(v) },
      ])
  );

let pass = 0;
let fail = 0;
const failures = [];

function check(name, actual, expected) {
  const denied =
    actual.status === 403 ||
    (actual.body?.error?.status === 'PERMISSION_DENIED') ||
    (actual.body?.error?.code === 7);
  const result = expected === 'DENIED' ? (denied ? 'DENIED' : `ALLOWED(${actual.status})`) : denied ? 'DENIED' : `ALLOWED(${actual.status})`;
  const ok = result === expected || (expected === 'ALLOWED' && result.startsWith('ALLOWED(') && !denied);
  if (ok) {
    pass++;
    console.log(`  PASS  ${name} -> ${result}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL  ${name} -> ${result} (expected ${expected})`);
    if (actual.body?.error?.message) {
      console.log(`        ${actual.body.error.message.slice(0, 200)}`);
    }
  }
}

// ---------------------------------------------------------------- fixtures
const validOrder = {
  id: 'ORD-TEST-1',
  customerName: 'Nguyen Van A',
  totalAmount: 150000,
  deliveryStatus: 'PENDING',
  paymentStatus: 'UNPAID',
  status: 'ACTIVE',
  createdAt: '2026-10-21T00:00:00.000Z',
};

const validUser = (id) => ({ id, name: 'Lan', role: 'CASHIER' });

const validSetting = {
  bankBin: '970422',
  bankCode: 'MB',
  bankName: 'MBBank',
  accountNumber: '0901234567',
  accountHolder: 'CHU SHOP HOA',
  qrTemplate: 'compact2',
};

const clean = async (coll, id, token = tokenFor({ uid: 'u-admin', email: 'khafibo@gmail.com' })) => {
  await request('DELETE', coll, id, null, token);
};

// ------------------------------------------------------------------- tests
const cases = async () => {
  console.log('\n--- 1. anonymous / unverified cannot touch anything ---');
  await clean('orders', 'ORD-ANON');
  check('anon: create order', await request('PATCH', 'orders', 'ORD-ANON', { ...validOrder, id: 'ORD-ANON' }, ANON), 'DENIED');
  check('anon: read order', await request('GET', 'orders', 'ORD-ANON', null, ANON), 'DENIED');

  await clean('orders', 'ORD-UNVER');
  check(
    'unverified user: create order',
    await request('PATCH', 'orders', 'ORD-UNVER', { ...validOrder, id: 'ORD-UNVER' }, UNVERIFIED),
    'DENIED'
  );

  console.log('\n--- 2. verified user can write valid orders ---');
  await clean('orders', 'ORD-OK');
  check(
    'verified: create valid order',
    await request('PATCH', 'orders', 'ORD-OK', { ...validOrder, id: 'ORD-OK' }, VERIFIED),
    'ALLOWED'
  );
  check('verified: read order', await request('GET', 'orders', 'ORD-OK', null, VERIFIED), 'ALLOWED');
  check(
    'verified: update order (partial)',
    await request('PATCH', 'orders', 'ORD-OK', { ...validOrder, id: 'ORD-OK', paymentStatus: 'PAID' }, VERIFIED),
    'ALLOWED'
  );

  console.log('\n--- 3. order validation is enforced ---');
  await clean('orders', 'ORD-BADSTATUS');
  check(
    'invalid deliveryStatus rejected',
    await request(
      'PATCH',
      'orders',
      'ORD-BADSTATUS',
      { ...validOrder, id: 'ORD-BADSTATUS', deliveryStatus: 'CANCELLED' },
      VERIFIED
    ),
    'DENIED'
  );
  await clean('orders', 'ORD-MISMATCH');
  check(
    'doc id != data.id rejected',
    await request('PATCH', 'orders', 'ORD-MISMATCH', { ...validOrder, id: 'ORD-OTHER' }, VERIFIED),
    'DENIED'
  );
  await clean('orders', 'ORD-NOCREATED');
  check(
    'missing required field rejected',
    await request(
      'PATCH',
      'orders',
      'ORD-NOCREATED',
      { ...validOrder, id: 'ORD-NOCREATED', createdAt: undefined },
      VERIFIED
    ),
    'DENIED'
  );

  console.log('\n--- 4. deletes are admin-only ---');
  check('verified: delete order', await request('DELETE', 'orders', 'ORD-OK', null, VERIFIED), 'DENIED');
  check('admin (bootstrap email): delete order', await request('DELETE', 'orders', 'ORD-OK', null, ADMIN), 'ALLOWED');

  console.log('\n--- 5. admin bootstrap via admins/{uid} collection ---');
  const adminsDoc = { uid: ADMIN_BY_DOC.sub, email: 'other@example.com' };
  // admins collection may only be written by an admin, so seed it as admin.
  await request('PATCH', 'admins', 'u-admin-doc', { uid: 'u-admin-doc', ...adminsDoc }, ADMIN);
  await clean('orders', 'ORD-ADMIN2');
  await request('PATCH', 'orders', 'ORD-ADMIN2', { ...validOrder, id: 'ORD-ADMIN2' }, ADMIN_BY_DOC);
  check('non-bootstrap admin: delete order', await request('DELETE', 'orders', 'ORD-ADMIN2', null, ADMIN_BY_DOC), 'ALLOWED');
  await clean('admins', 'u-admin-doc');

  console.log('\n--- 6. staff profiles must not carry a `pin` credential ---');
  await clean('users', 'staff-nopin');
  check('staff without pin: allowed', await request('PATCH', 'users', 'staff-nopin', validUser('staff-nopin'), VERIFIED), 'ALLOWED');
  await clean('users', 'staff-withpin');
  check(
    'staff with plaintext pin: rejected',
    await request('PATCH', 'users', 'staff-withpin', { ...validUser('staff-withpin'), pin: '1234' }, VERIFIED),
    'DENIED'
  );
  await clean('users', 'staff-badrole');
  check(
    'staff with unknown role: rejected',
    await request('PATCH', 'users', 'staff-badrole', { ...validUser('staff-badrole'), role: 'SUPERUSER' }, VERIFIED),
    'DENIED'
  );

  console.log('\n--- 7. settings (bank config) is admin-write only ---');
  await clean('settings', 'bankConfig');
  check('verified user: write bank config', await request('PATCH', 'settings', 'bankConfig', validSetting, VERIFIED), 'DENIED');
  check('admin: write valid bank config', await request('PATCH', 'settings', 'bankConfig', validSetting, ADMIN), 'ALLOWED');
  check(
    'admin: invalid qrTemplate rejected',
    await request('PATCH', 'settings', 'bankConfig', { ...validSetting, qrTemplate: 'huge' }, ADMIN),
    'DENIED'
  );
  check('verified user: read bank config', await request('GET', 'settings', 'bankConfig', null, VERIFIED), 'ALLOWED');

  console.log('\n--- 8. test collection is no longer a public scratchpad ---');
  await clean('test', 'connection');
  check('anon: write test doc', await request('PATCH', 'test', 'connection', { ping: 'pong' }, ANON), 'DENIED');
  check('anon: read test doc', await request('GET', 'test', 'connection', null, ANON), 'DENIED');
  check('verified: write test doc', await request('PATCH', 'test', 'connection', { ping: 'pong' }, VERIFIED), 'ALLOWED');

  console.log('\n--- 9. unknown collections stay denied ---');
  check('verified: read unknown collection', await request('GET', 'secrets', 'x', null, VERIFIED), 'DENIED');
};

// ------------------------------------------------------------------- main
try {
  await cases();
} catch (err) {
  console.error('\nHarness error (is the emulator running?):', err.message);
  process.exit(2);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('Failed assertions:\n - ' + failures.join('\n - '));
  process.exit(1);
}
