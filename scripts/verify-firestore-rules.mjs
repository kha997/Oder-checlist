#!/usr/bin/env node
/**
 * Firestore security rules verification.
 *
 * Runs real requests against the Firestore emulator and asserts that
 * firestore.rules allow/deny exactly what they claim. No extra dependencies:
 * the emulator decodes (and does not verify the signature of) JWTs, so we
 * forge tokens carrying the claims we want to exercise.
 *
 * The rules resolve legacy roles from `staffRoles/{auth.uid}` documents, and
 * multi-tenant (T1) roles from `shops/{shopId}/members/{auth.uid}` — so most
 * assertions here are about a seeded membership document rather than a claim.
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

// ---------------------------------------------------------------- identities
const ANON = tokenFor(null);
const UNVERIFIED = tokenFor({ uid: 'u-unverified', email: 'spam@example.com', emailVerified: false });
/** Bootstrap admin: authorised by email alone, no role document needed. */
const BOOTSTRAP = tokenFor({ uid: 'u-bootstrap', email: 'khafibo@gmail.com' });
/** Signed in, verified, but nobody granted it a role. */
const NO_ROLE = tokenFor({ uid: 'u-norole', email: 'norole@example.com' });
/** Admin through a `staffRoles/{uid}` document. */
const ADMIN_BY_ROLE = tokenFor({ uid: 'u-admin-role', email: 'boss@example.com' });
/** Admin through the legacy `admins/{uid}` collection. */
const ADMIN_BY_DOC = tokenFor({ uid: 'u-admin-doc', email: 'legacy@example.com' });
const KITCHEN = tokenFor({ uid: 'u-kitchen', email: 'kitchen@example.com' });
const SHIPPER = tokenFor({ uid: 'u-shipper', email: 'shipper@example.com' });
const CASHIER = tokenFor({ uid: 'u-cashier', email: 'cashier@example.com' });

// ---------------------------------------------------------- T1 identities
/** Two independent shop owners (each may create exactly one shop). */
const OWNER_A = tokenFor({ uid: 'u-owner-a', email: 'ownera@example.com' });
const OWNER_B = tokenFor({ uid: 'u-owner-b', email: 'ownerb@example.com' });
/** Members of shop A, approved by its owner. */
const MEMBER_A_KITCHEN = tokenFor({ uid: 'u-mem-a-kitchen', email: 'kitchen.a@example.com' });
const MEMBER_A_CASHIER = tokenFor({ uid: 'u-mem-a-cashier', email: 'cashier.a@example.com' });
/** Outsiders: no membership anywhere. */
const JOINER = tokenFor({ uid: 'u-joiner', email: 'joiner@example.com' });
const STRANGER = tokenFor({ uid: 'u-stranger', email: 'stranger@example.com' });

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

/** List a collection (query). `filter` = Firestore where-filter, e.g. `shopId=="shp_a"`. */
async function list(coll, token, filter) {
  const res = await fetch(`${BASE}/${coll}${filter ? `?filter=${encodeURIComponent(filter)}` : ''}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* ignore non-JSON */
  }
  return { status: res.status, body };
}

/**
 * Run a REAL filtered query via `:runQuery` (ListDocuments has no `filter`
 * parameter — the earlier `?filter=` was silently ignored, which made every
 * "filtered" assertion actually test an unfiltered query).
 * Returns { status, body, documents } in the same shape as list().
 */
async function queryBy(coll, token, field, value) {
  // `:runQuery` hangs off the DATABASE ROOT for top-level collections and off
  // the PARENT DOCUMENT for a subcollection ('shops/x/members' -> 'shops/x').
  const segs = coll.split('/');
  const parentPath = segs.length > 1 ? segs.slice(0, -1).join('/') : '';
  const collectionId = segs[segs.length - 1];
  const res = await fetch(`${BASE}${parentPath ? '/' + parentPath : ''}:runQuery`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op: 'EQUAL',
            value: { stringValue: value },
          },
        },
      },
    }),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* ignore non-JSON */
  }
  const documents = Array.isArray(body) ? body.map((e) => e.document).filter(Boolean) : [];
  return { status: res.status, body, documents };
}

const toFields = (data) =>
  Object.fromEntries(
    Object.entries(data)
      .filter(([, v]) => v !== undefined) // mirror the app's sanitizeForFirestore()
      .map(([k, v]) => [k, toValue(v)])
  );

/** JSON -> Firestore `typedValue`, including arrays (accounts.shops). */
function toValue(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}


let pass = 0;
let fail = 0;
const failures = [];

function check(name, actual, expected) {
  const denied =
    actual.status === 403 ||
    (actual.body?.error?.status === 'PERMISSION_DENIED') ||
    (actual.body?.error?.code === 7);
  const result = expected === 'DENIED' ? (denied ? 'DENIED' : `ALLOWED(${actual.status})`) : denied ? 'DENIED' : `ALLOWED(${actual.status})`;
  const ok =
    result === expected ||
    (expected === 'ALLOWED' &&
      !denied &&
      (actual.status < 400 || actual.status === 404)); // 400/500 = harness bug, never a pass
  if (ok) {
    pass++;
    console.log(`  PASS  ${name} -> ${result}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL  ${name} -> ${result} (expected ${expected})`);
    if (actual.body?.error?.message) {
      console.log(`        ${actual.body.error.message.slice(0, 900)}`);
    }
  }
}

// ---------------------------------------------------------------- fixtures
const validOrder = (id = 'ORD-TEST-1') => ({
  id,
  customerName: 'Nguyen Van A',
  totalAmount: 150000,
  deliveryStatus: 'PENDING',
  paymentStatus: 'UNPAID',
  status: 'ACTIVE',
  createdAt: '2026-10-21T00:00:00.000Z',
});

const validCustomer = (id = 'CUS-TEST-1') => ({
  id,
  name: 'Lan',
  phone: '0900000000',
  defaultLocationType: 'condo',
});

const validProduct = (id = 'PRD-TEST-1') => ({
  id,
  name: 'Mi',
  price: 30000,
  initialStock: 10,
  stockReceived: 0,
  unit: 'Phan',
});

const validCondo = (id = 'CDO-TEST-1') => ({ id, name: 'Sunrise City' });

const validStockLog = (id = 'LOG-TEST-1') => ({
  id,
  productId: 'PRD-TEST-1',
  productName: 'Mi',
  quantityAdded: 5,
  date: '2026-10-21',
});

const validUser = (id) => ({ id, name: 'Lan', role: 'CASHIER' });

const validSetting = {
  bankBin: '970422',
  bankCode: 'MB',
  bankName: 'MBBank',
  accountNumber: '0901234567',
  accountHolder: 'CHU SHOP HOA',
  qrTemplate: 'compact2',
};

const staffRole = (uid, role, email = `${uid}@example.com`) => ({
  uid,
  email,
  displayName: uid,
  role,
  createdAt: '2026-10-21T00:00:00.000Z',
});

const staffRequest = (uid, email = `${uid}@example.com`) => ({
  uid,
  email,
  displayName: uid,
  requestedAt: '2026-10-21T00:00:00.000Z',
});

// ---------------------------------------------------------- T1 fixtures
const NOW = '2026-10-25T00:00:00.000Z';

const shop = (id, ownerUid, ownerEmail, inviteCode = 'INVITE01') => ({
  shopId: id,
  name: `Shop ${id}`,
  ownerUid,
  ownerEmail,
  inviteCode,
  status: 'active',
  createdAt: NOW,
});

const account = (uid, email, shops = [], defaultShopId = shops[0] ?? '') => ({
  uid,
  email,
  displayName: uid,
  shops,
  defaultShopId,
});

const member = (uid, shopId, role, status, extra = {}) => ({
  uid,
  shopId,
  email: `${uid}@example.com`,
  displayName: uid,
  role,
  status,
  createdAt: NOW,
  ...extra,
});

const invite = (code, shopId, createdBy = 'u-owner-a') => ({
  code,
  shopId,
  createdBy,
  createdAt: NOW,
});

const withShop = (doc, shopId) => ({ ...doc, shopId });

const clean = async (coll, id, token = BOOTSTRAP) => {
  await request('DELETE', coll, id, null, token);
};

// ------------------------------------------------------------------- tests
const cases = async () => {
  console.log('\n--- 1. anonymous / unverified cannot touch anything ---');
  await clean('orders', 'ORD-ANON');
  check('anon: create order', await request('PATCH', 'orders', 'ORD-ANON', validOrder('ORD-ANON'), ANON), 'DENIED');
  check('anon: read order', await request('GET', 'orders', 'ORD-ANON', null, ANON), 'DENIED');
  check('anon: list orders', await list('orders', ANON), 'DENIED');
  check('unverified: create order', await request('PATCH', 'orders', 'ORD-UNV', validOrder('ORD-UNV'), UNVERIFIED), 'DENIED');
  check('unverified: read bank config', await request('GET', 'settings', 'bankConfig', null, UNVERIFIED), 'DENIED');

  console.log('\n--- 2. a verified account with NO role has NO access ---');
  await clean('orders', 'ORD-NOROLE');
  await request('PATCH', 'orders', 'ORD-NOROLE', validOrder('ORD-NOROLE'), BOOTSTRAP);
  check('no role: read order', await request('GET', 'orders', 'ORD-NOROLE', null, NO_ROLE), 'DENIED');
  check('no role: list orders', await list('orders', NO_ROLE), 'DENIED');
  check('no role: create order', await request('PATCH', 'orders', 'ORD-NOROLE-2', validOrder('ORD-NOROLE-2'), NO_ROLE), 'DENIED');
  check('no role: read bank config', await request('GET', 'settings', 'bankConfig', null, NO_ROLE), 'DENIED');
  check('no role: read products', await list('products', NO_ROLE), 'DENIED');
  check('no role: write staff user', await request('PATCH', 'users', 'u-staff-x', validUser('u-staff-x'), NO_ROLE), 'DENIED');

  console.log('\n--- 3. seed role documents + shared fixtures ---');
  await clean('staffRoles', 'u-admin-role');
  await clean('staffRoles', 'u-kitchen');
  await clean('staffRoles', 'u-shipper');
  await clean('staffRoles', 'u-cashier');
  await clean('admins', 'u-admin-doc');
  await request('PATCH', 'staffRoles', 'u-admin-role', staffRole('u-admin-role', 'ADMIN'), BOOTSTRAP);
  await request('PATCH', 'staffRoles', 'u-kitchen', staffRole('u-kitchen', 'KITCHEN'), BOOTSTRAP);
  await request('PATCH', 'staffRoles', 'u-shipper', staffRole('u-shipper', 'SHIPPER'), BOOTSTRAP);
  await request('PATCH', 'staffRoles', 'u-cashier', staffRole('u-cashier', 'CASHIER'), BOOTSTRAP);
  await request('PATCH', 'admins', 'u-admin-doc', { uid: 'u-admin-doc', email: 'legacy@example.com' }, BOOTSTRAP);

  await clean('orders', 'ORD-TEST-1');
  await clean('customers', 'CUS-TEST-1');
  await clean('products', 'PRD-TEST-1');
  await clean('condos', 'CDO-TEST-1');
  await clean('stockLogs', 'LOG-TEST-1');
  await clean('users', 'u-staff-1');
  await clean('settings', 'bankConfig');
  await request('PATCH', 'orders', 'ORD-TEST-1', validOrder('ORD-TEST-1'), BOOTSTRAP);
  await request('PATCH', 'customers', 'CUS-TEST-1', validCustomer('CUS-TEST-1'), BOOTSTRAP);
  await request('PATCH', 'products', 'PRD-TEST-1', validProduct('PRD-TEST-1'), BOOTSTRAP);
  await request('PATCH', 'condos', 'CDO-TEST-1', validCondo('CDO-TEST-1'), BOOTSTRAP);
  await request('PATCH', 'stockLogs', 'LOG-TEST-1', validStockLog('LOG-TEST-1'), BOOTSTRAP);
  await request('PATCH', 'users', 'u-staff-1', validUser('u-staff-1'), BOOTSTRAP);
  await request('PATCH', 'settings', 'bankConfig', validSetting, BOOTSTRAP);

  console.log('\n--- 4. ADMIN by bootstrap email (no role document) ---');
  check('bootstrap admin: read order', await request('GET', 'orders', 'ORD-TEST-1', null, BOOTSTRAP), 'ALLOWED');
  check('bootstrap admin: update order', await request('PATCH', 'orders', 'ORD-TEST-1', { ...validOrder('ORD-TEST-1'), totalAmount: 160000 }, BOOTSTRAP), 'ALLOWED');
  check('bootstrap admin: delete order', await request('DELETE', 'orders', 'ORD-TEST-1', null, BOOTSTRAP), 'ALLOWED');
  check('bootstrap admin: write bank config', await request('PATCH', 'settings', 'bankConfig', validSetting, BOOTSTRAP), 'ALLOWED');
  check('bootstrap admin: write staff user', await request('PATCH', 'users', 'u-staff-1', validUser('u-staff-1'), BOOTSTRAP), 'ALLOWED');
  check('bootstrap admin: write product', await request('PATCH', 'products', 'PRD-TEST-1', validProduct('PRD-TEST-1'), BOOTSTRAP), 'ALLOWED');

  console.log('\n--- 5. ADMIN by role document ---');
  check('role admin: read order', await request('GET', 'orders', 'ORD-TEST-1', null, ADMIN_BY_ROLE), 'ALLOWED');
  check('role admin: update order', await request('PATCH', 'orders', 'ORD-TEST-1', validOrder('ORD-TEST-1'), ADMIN_BY_ROLE), 'ALLOWED');
  check('role admin: delete order', await request('DELETE', 'orders', 'ORD-TEST-1', null, ADMIN_BY_ROLE), 'ALLOWED');
  check('role admin: write product', await request('PATCH', 'products', 'PRD-TEST-1', validProduct('PRD-TEST-1'), ADMIN_BY_ROLE), 'ALLOWED');
  check('role admin: write bank config', await request('PATCH', 'settings', 'bankConfig', validSetting, ADMIN_BY_ROLE), 'ALLOWED');

  console.log('\n--- 6. ADMIN by legacy admins/{uid} ---');
  check('legacy admin: delete order', await request('DELETE', 'orders', 'ORD-TEST-1', null, ADMIN_BY_DOC), 'ALLOWED');
  check('legacy admin: write bank config', await request('PATCH', 'settings', 'bankConfig', validSetting, ADMIN_BY_DOC), 'ALLOWED');

  console.log('\n--- 7. KITCHEN ---');
  check('kitchen: read order', await request('GET', 'orders', 'ORD-TEST-1', null, KITCHEN), 'ALLOWED');
  check('kitchen: read product', await request('GET', 'products', 'PRD-TEST-1', null, KITCHEN), 'ALLOWED');
  check('kitchen: read stock log', await request('GET', 'stockLogs', 'LOG-TEST-1', null, KITCHEN), 'ALLOWED');
  check('kitchen: read staff user', await request('GET', 'users', 'u-staff-1', null, KITCHEN), 'ALLOWED');
  check('kitchen: update order (mark ready)', await request('PATCH', 'orders', 'ORD-TEST-1', { ...validOrder('ORD-TEST-1'), deliveryStatus: 'READY_FOR_DELIVERY' }, KITCHEN), 'ALLOWED');
  check('kitchen: write product', await request('PATCH', 'products', 'PRD-TEST-1', validProduct('PRD-TEST-1'), KITCHEN), 'DENIED');
  check('kitchen: write stock log', await request('PATCH', 'stockLogs', 'LOG-TEST-1', validStockLog('LOG-TEST-1'), KITCHEN), 'DENIED');
  check('kitchen: write customer', await request('PATCH', 'customers', 'CUS-TEST-1', validCustomer('CUS-TEST-1'), KITCHEN), 'DENIED');
  check('kitchen: write staff user', await request('PATCH', 'users', 'u-staff-1', validUser('u-staff-1'), KITCHEN), 'DENIED');
  check('kitchen: write bank config', await request('PATCH', 'settings', 'bankConfig', validSetting, KITCHEN), 'DENIED');
  check('kitchen: delete order', await request('DELETE', 'orders', 'ORD-TEST-1', null, KITCHEN), 'DENIED');

  console.log('\n--- 8. SHIPPER ---');
  check('shipper: read order', await request('GET', 'orders', 'ORD-TEST-1', null, SHIPPER), 'ALLOWED');
  check('shipper: update order (delivered + POD)', await request('PATCH', 'orders', 'ORD-TEST-1', { ...validOrder('ORD-TEST-1'), deliveryStatus: 'DELIVERED' }, SHIPPER), 'ALLOWED');
  check('shipper: write customer', await request('PATCH', 'customers', 'CUS-TEST-1', validCustomer('CUS-TEST-1'), SHIPPER), 'DENIED');
  check('shipper: write product', await request('PATCH', 'products', 'PRD-TEST-1', validProduct('PRD-TEST-1'), SHIPPER), 'DENIED');
  check('shipper: write stock log', await request('PATCH', 'stockLogs', 'LOG-TEST-1', validStockLog('LOG-TEST-1'), SHIPPER), 'DENIED');
  check('shipper: write staff user', await request('PATCH', 'users', 'u-staff-1', validUser('u-staff-1'), SHIPPER), 'DENIED');
  check('shipper: write bank config', await request('PATCH', 'settings', 'bankConfig', validSetting, SHIPPER), 'DENIED');
  check('shipper: delete order', await request('DELETE', 'orders', 'ORD-TEST-1', null, SHIPPER), 'DENIED');

  console.log('\n--- 9. CASHIER ---');
  check('cashier: read order', await request('GET', 'orders', 'ORD-TEST-1', null, CASHIER), 'ALLOWED');
  check('cashier: update order (confirm payment)', await request('PATCH', 'orders', 'ORD-TEST-1', { ...validOrder('ORD-TEST-1'), paymentStatus: 'PAID' }, CASHIER), 'ALLOWED');
  check('cashier: write customer', await request('PATCH', 'customers', 'CUS-TEST-1', validCustomer('CUS-TEST-1'), CASHIER), 'ALLOWED');
  check('cashier: write product', await request('PATCH', 'products', 'PRD-TEST-1', validProduct('PRD-TEST-1'), CASHIER), 'DENIED');
  check('cashier: write stock log', await request('PATCH', 'stockLogs', 'LOG-TEST-1', validStockLog('LOG-TEST-1'), CASHIER), 'DENIED');
  check('cashier: write staff user', await request('PATCH', 'users', 'u-staff-1', validUser('u-staff-1'), CASHIER), 'DENIED');
  check('cashier: write bank config', await request('PATCH', 'settings', 'bankConfig', validSetting, CASHIER), 'DENIED');
  check('cashier: delete order', await request('DELETE', 'orders', 'ORD-TEST-1', null, CASHIER), 'DENIED');

  console.log('\n--- 10. nobody can escalate their own role ---');
  // NOTE: `u-cashier` keeps its role here — later groups still use it. The
  // "target uid" of an escalation attempt is a throwaway.
  await clean('staffRoles', 'u-norole');
  await clean('staffRoles', 'u-victim');
  await clean('staffRequests', 'u-norole');
  await clean('staffRequests', 'u-victim');
  check('no role: create own staffRoles', await request('PATCH', 'staffRoles', 'u-norole', staffRole('u-norole', 'ADMIN'), NO_ROLE), 'DENIED');
  check('no role: create staffRoles for another uid', await request('PATCH', 'staffRoles', 'u-victim', staffRole('u-victim', 'ADMIN'), NO_ROLE), 'DENIED');
  check('kitchen: create own staffRoles', await request('PATCH', 'staffRoles', 'u-kitchen', staffRole('u-kitchen', 'ADMIN'), KITCHEN), 'DENIED');
  check('no role: create own staffRequests', await request('PATCH', 'staffRequests', 'u-norole', staffRequest('u-norole'), NO_ROLE), 'ALLOWED');
  check('no role: create own staffRequests WITH role field', await request('PATCH', 'staffRequests', 'u-norole-2', { ...staffRequest('u-norole-2'), role: 'ADMIN' }, NO_ROLE), 'DENIED');
  check('no role: create staffRequests for another uid', await request('PATCH', 'staffRequests', 'u-victim', staffRequest('u-victim'), NO_ROLE), 'DENIED');
  check('no role: read own staffRequests', await request('GET', 'staffRequests', 'u-norole', null, NO_ROLE), 'ALLOWED');
  check('no role: list staffRequests', await list('staffRequests', NO_ROLE), 'DENIED');
  check('admin: list staffRequests', await list('staffRequests', ADMIN_BY_ROLE), 'ALLOWED');
  check('kitchen: read own staffRoles', await request('GET', 'staffRoles', 'u-kitchen', null, KITCHEN), 'ALLOWED');
  check('kitchen: read another uid staffRoles', await request('GET', 'staffRoles', 'u-cashier', null, KITCHEN), 'DENIED');
  check('kitchen: list staffRoles', await list('staffRoles', KITCHEN), 'DENIED');
  check('admin: create staffRoles with mismatched uid field', await request('PATCH', 'staffRoles', 'u-new-admin', staffRole('u-someone-else', 'ADMIN'), ADMIN_BY_ROLE), 'DENIED');
  check('admin: create staffRoles with invalid role', await request('PATCH', 'staffRoles', 'u-bad-role', staffRole('u-bad-role', 'SUPERUSER'), ADMIN_BY_ROLE), 'DENIED');
  check('admin: create staffRoles missing required field', await request('PATCH', 'staffRoles', 'u-incomplete', { uid: 'u-incomplete', role: 'ADMIN' }, ADMIN_BY_ROLE), 'DENIED');

  console.log('\n--- 11. document validation still enforced ---');
  check('role admin: order id must match document id', await request('PATCH', 'orders', 'ORD-MISMATCH', validOrder('ORD-OTHER'), ADMIN_BY_ROLE), 'DENIED');
  check('role admin: order rejects unknown deliveryStatus', await request('PATCH', 'orders', 'ORD-BAD', { ...validOrder('ORD-BAD'), deliveryStatus: 'TELEPORTED' }, ADMIN_BY_ROLE), 'DENIED');
  check('role admin: order rejects missing required field', await request('PATCH', 'orders', 'ORD-BAD2', { id: 'ORD-BAD2', customerName: 'A', totalAmount: 1 }, ADMIN_BY_ROLE), 'DENIED');
  check('role admin: staff profile rejects plaintext pin', await request('PATCH', 'users', 'u-staff-pin', { id: 'u-staff-pin', name: 'Lan', role: 'CASHIER', pin: '1234' }, ADMIN_BY_ROLE), 'DENIED');
  check('role admin: unknown collection stays denied', await request('GET', 'secrets', 'x', null, ADMIN_BY_ROLE), 'DENIED');

  console.log('\n--- 12. test collection is not a public scratchpad ---');
  await clean('test', 'connection');
  check('anon: write test doc', await request('PATCH', 'test', 'connection', { ping: 'pong' }, ANON), 'DENIED');
  check('no role: write test doc', await request('PATCH', 'test', 'connection', { ping: 'pong' }, NO_ROLE), 'DENIED');
  check('cashier: write test doc', await request('PATCH', 'test', 'connection', { ping: 'pong' }, CASHIER), 'ALLOWED');

  console.log('\n--- 13. revoking a role removes access immediately ---');
  check('admin: revoke cashier role', await request('DELETE', 'staffRoles', 'u-cashier', null, ADMIN_BY_ROLE), 'ALLOWED');
  check('revoked cashier: read order', await request('GET', 'orders', 'ORD-TEST-1', null, CASHIER), 'DENIED');
  check('revoked cashier: write customer', await request('PATCH', 'customers', 'CUS-TEST-1', validCustomer('CUS-TEST-1'), CASHIER), 'DENIED');

  // =====================================================================
  // T1 — MULTI-TENANCY (docs/MULTI-TENANT-SPEC.md)
  // =====================================================================

  console.log('\n--- 14. T1: accounts index + one-shop-per-account ---');
  check('accounts: owner creates own index', await request('PATCH', 'accounts', 'u-owner-a', account('u-owner-a', 'ownera@example.com'), OWNER_A), 'ALLOWED');
  check('accounts: cannot create an index for another uid', await request('PATCH', 'accounts', 'u-victim-acct', account('u-victim-acct', 'victim@example.com'), OWNER_A), 'DENIED');
  check('accounts: anonymous create denied', await request('PATCH', 'accounts', 'u-anon-acct', account('u-anon-acct', 'anon@example.com'), ANON), 'DENIED');
  check('accounts: outsider cannot read my index', await request('GET', 'accounts', 'u-owner-a', null, STRANGER), 'DENIED');
  check('accounts: owner reads own index', await request('GET', 'accounts', 'u-owner-a', null, OWNER_A), 'ALLOWED');
  check('accounts: delete denied (guard must be permanent)', await request('DELETE', 'accounts', 'u-owner-a', null, OWNER_A), 'DENIED');
  // P3 migration: the bootstrap super-admin provisions indexes for staff
  // moved from `staffRoles`. Nobody else may write an index that is not
  // their own (the OWNER_A case above pins that).
  check('accounts: super-admin provisions an index for a migrated staff uid', await request('PATCH', 'accounts', 'u-migrated-staff', account('u-migrated-staff', 'migrated@example.com'), BOOTSTRAP), 'ALLOWED');
  check('accounts: super-admin reads a migrated staff index', await request('GET', 'accounts', 'u-migrated-staff', null, BOOTSTRAP), 'ALLOWED');
  check('accounts: super-admin attaches the shop to a migrated index', await request('PATCH', 'accounts', 'u-migrated-staff', account('u-migrated-staff', 'migrated@example.com', ['shp_alpha']), BOOTSTRAP), 'ALLOWED');
  check('accounts: super-admin may re-home a migrated index (shrink carve-out)', await request('PATCH', 'accounts', 'u-migrated-staff', account('u-migrated-staff', 'migrated@example.com'), BOOTSTRAP), 'ALLOWED');
  check('accounts: super-admin still bound by isValidAccount (missing field denied)', await request('PATCH', 'accounts', 'u-migrated-staff', { uid: 'u-migrated-staff', email: 'migrated@example.com' }, BOOTSTRAP), 'DENIED');

  check('shop A: owner creates', await request('PATCH', 'shops', 'shp_alpha', shop('shp_alpha', 'u-owner-a', 'ownera@example.com'), OWNER_A), 'ALLOWED');
  check('shop: rejected when no accounts doc exists', await request('PATCH', 'shops', 'shp_noacct', shop('shp_noacct', 'u-stranger', 'stranger@example.com'), STRANGER), 'DENIED');
  check('shop: ownerUid must be the caller', await request('PATCH', 'shops', 'shp_hijack', shop('shp_hijack', 'u-owner-a', 'ownera@example.com'), OWNER_B), 'DENIED');

  check('accounts: second owner creates own index', await request('PATCH', 'accounts', 'u-owner-b', account('u-owner-b', 'ownerb@example.com'), OWNER_B), 'ALLOWED');
  check('shop B: independent owner creates own shop', await request('PATCH', 'shops', 'shp_beta', shop('shp_beta', 'u-owner-b', 'ownerb@example.com', 'JOINB01'), OWNER_B), 'ALLOWED');

  check('accounts: shop list grows after creation', await request('PATCH', 'accounts', 'u-owner-a', account('u-owner-a', 'ownera@example.com', ['shp_alpha']), OWNER_A), 'ALLOWED');
  check('accounts: shop list can never shrink', await request('PATCH', 'accounts', 'u-owner-a', account('u-owner-a', 'ownera@example.com'), OWNER_A), 'DENIED');
  check('shop A: a second shop for the same account is denied', await request('PATCH', 'shops', 'shp_alpha2', shop('shp_alpha2', 'u-owner-a', 'ownera@example.com'), OWNER_A), 'DENIED');
  check('shop: hard delete denied (archive instead)', await request('DELETE', 'shops', 'shp_alpha', null, OWNER_A), 'DENIED');

  console.log('\n--- 15. T1: membership, invite codes, approval ---');
  // The app creates the owner's ADMIN seat in the same batch as the shop.
  check('member: owner seats self as ADMIN', await request('PATCH', 'shops/shp_alpha/members', 'u-owner-a', member('u-owner-a', 'shp_alpha', 'ADMIN', 'active'), OWNER_A), 'ALLOWED');
  check('member: uid must match path', await request('PATCH', 'shops/shp_alpha/members', 'u-owner-a', member('u-other-uid', 'shp_alpha', 'ADMIN', 'active'), OWNER_A), 'DENIED');
  check('member: shopId must match path', await request('PATCH', 'shops/shp_alpha/members', 'u-owner-a', { ...member('u-owner-a', 'shp_alpha', 'ADMIN', 'active'), shopId: 'shp_beta' }, OWNER_A), 'DENIED');
  check('member: owner B seats self as ADMIN of B', await request('PATCH', 'shops/shp_beta/members', 'u-owner-b', member('u-owner-b', 'shp_beta', 'ADMIN', 'active'), OWNER_B), 'ALLOWED');

  check('join: pending WITHOUT invite code denied', await request('PATCH', 'shops/shp_alpha/members', 'u-joiner', member('u-joiner', 'shp_alpha', 'CASHIER', 'pending'), JOINER), 'DENIED');
  check('invite: admin A mints a code', await request('PATCH', 'inviteCodes', 'INVITE01', invite('INVITE01', 'shp_alpha'), OWNER_A), 'ALLOWED');
  check('invite: outsider reads a code (bearer token)', await request('GET', 'inviteCodes', 'INVITE01', null, JOINER), 'ALLOWED');
  check('join: pending WITH valid invite allowed', await request('PATCH', 'shops/shp_alpha/members', 'u-joiner', member('u-joiner', 'shp_alpha', 'CASHIER', 'pending', { inviteCode: 'INVITE01' }), JOINER), 'ALLOWED');
  check('join: pending cannot self-activate (escalation)', await request('PATCH', 'shops/shp_alpha/members', 'u-joiner', { ...member('u-joiner', 'shp_alpha', 'CASHIER', 'active'), inviteCode: 'INVITE01' }, JOINER), 'DENIED');
  check('join: pending cannot self-promote to ADMIN', await request('PATCH', 'shops/shp_alpha/members', 'u-joiner', member('u-joiner', 'shp_alpha', 'ADMIN', 'active'), JOINER), 'DENIED');
  check('join: cannot create a member doc for someone else', await request('PATCH', 'shops/shp_alpha/members', 'u-victim-member', member('u-victim-member', 'shp_alpha', 'ADMIN', 'active'), JOINER), 'DENIED');
  check('join: wrong invite code denied', await request('PATCH', 'shops/shp_alpha/members', 'u-stranger', member('u-stranger', 'shp_alpha', 'ADMIN', 'pending', { inviteCode: 'WRONG99' }), STRANGER), 'DENIED');

  check('admin: approves joiner as CASHIER', await request('PATCH', 'shops/shp_alpha/members', 'u-joiner', member('u-joiner', 'shp_alpha', 'CASHIER', 'active', { inviteCode: 'INVITE01' }), OWNER_A), 'ALLOWED');
  check('admin: adds a KITCHEN member', await request('PATCH', 'shops/shp_alpha/members', 'u-mem-a-kitchen', member('u-mem-a-kitchen', 'shp_alpha', 'KITCHEN', 'active'), OWNER_A), 'ALLOWED');
  check('admin: adds a CASHIER member', await request('PATCH', 'shops/shp_alpha/members', 'u-mem-a-cashier', member('u-mem-a-cashier', 'shp_alpha', 'CASHIER', 'active'), OWNER_A), 'ALLOWED');
  check('non-admin member cannot add a member', await request('PATCH', 'shops/shp_alpha/members', 'u-mem-a-x', member('u-mem-a-x', 'shp_alpha', 'ADMIN', 'active'), MEMBER_A_KITCHEN), 'DENIED');
  check('member cannot promote themselves', await request('PATCH', 'shops/shp_alpha/members', 'u-mem-a-kitchen', member('u-mem-a-kitchen', 'shp_alpha', 'ADMIN', 'active'), MEMBER_A_KITCHEN), 'DENIED');
  check('admin lists members', await list('shops/shp_alpha/members', OWNER_A), 'ALLOWED');
  check('cashier lists members (roster)', await list('shops/shp_alpha/members', JOINER), 'ALLOWED');
  check('outsider lists members', await list('shops/shp_alpha/members', STRANGER), 'DENIED');
  check('outsider reads a member doc', await request('GET', 'shops/shp_alpha/members', 'u-owner-a', null, STRANGER), 'DENIED');
  check('member reads own member doc', await request('GET', 'shops/shp_alpha/members', 'u-joiner', null, JOINER), 'ALLOWED');
  check('member of A cannot read members of B', await list('shops/shp_beta/members', MEMBER_A_KITCHEN), 'DENIED');
  check('invite: admin A mints a second code', await request('PATCH', 'inviteCodes', 'INVITE02', invite('INVITE02', 'shp_alpha'), OWNER_A), 'ALLOWED');
  check('join: second stranger joins as pending', await request('PATCH', 'shops/shp_alpha/members', 'u-stranger', member('u-stranger', 'shp_alpha', 'CASHIER', 'pending', { inviteCode: 'INVITE02' }), STRANGER), 'ALLOWED');
  check('member can leave (delete own pending seat)', await request('DELETE', 'shops/shp_alpha/members', 'u-stranger', null, STRANGER), 'ALLOWED');

  console.log('\n--- 16. T1: shop-scoped orders — the where() filter is mandatory ---');
  const orderA = withShop(validOrder('ORD-SHOP-A'), 'shp_alpha');
  const orderB = withShop(validOrder('ORD-SHOP-B'), 'shp_beta');
  check('shop A: admin creates scoped order', await request('PATCH', 'orders', 'ORD-SHOP-A', orderA, OWNER_A), 'ALLOWED');
  check('shop B: admin creates scoped order', await request('PATCH', 'orders', 'ORD-SHOP-B', orderB, OWNER_B), 'ALLOWED');
  check('outsider cannot write into shop A', await request('PATCH', 'orders', 'ORD-SHOP-X', withShop(validOrder('ORD-SHOP-X'), 'shp_alpha'), STRANGER), 'DENIED');
  check('shop B cannot write into shop A', await request('PATCH', 'orders', 'ORD-SHOP-Y', withShop(validOrder('ORD-SHOP-Y'), 'shp_alpha'), OWNER_B), 'DENIED');
  check('member of A reads own-shop order', await request('GET', 'orders', 'ORD-SHOP-A', null, MEMBER_A_KITCHEN), 'ALLOWED');
  check('member of A cannot read shop B order', await request('GET', 'orders', 'ORD-SHOP-B', null, MEMBER_A_KITCHEN), 'DENIED');
  check('filtered list (own shop) ALLOWED', await queryBy('orders', MEMBER_A_KITCHEN, 'shopId', 'shp_alpha'), 'ALLOWED');
  check('UNFILTERED list DENIED — rules are not filters', await list('orders', MEMBER_A_KITCHEN), 'DENIED');
  check('filtered list for another shop DENIED', await queryBy('orders', MEMBER_A_KITCHEN, 'shopId', 'shp_beta'), 'DENIED');
  check('outsider filtered list DENIED', await queryBy('orders', STRANGER, 'shopId', 'shp_alpha'), 'DENIED');
  check('super-admin filtered list ALLOWED', await queryBy('orders', BOOTSTRAP, 'shopId', 'shp_beta'), 'ALLOWED');
  check('super-admin unfiltered list still fails closed', await list('orders', BOOTSTRAP), 'DENIED');
  check('moving a doc across shops is frozen', await request('PATCH', 'orders', 'ORD-SHOP-A', { ...orderA, shopId: 'shp_beta' }, OWNER_A), 'DENIED');
  check('kitchen of A updates own order', await request('PATCH', 'orders', 'ORD-SHOP-A', { ...orderA, deliveryStatus: 'READY_FOR_DELIVERY' }, MEMBER_A_KITCHEN), 'ALLOWED');
  check('super-admin can write into any shop', await request('PATCH', 'orders', 'ORD-SHOP-B', { ...orderB, paymentStatus: 'PAID' }, BOOTSTRAP), 'ALLOWED');

  console.log('\n--- 17. T1: write matrix per shop (customers / catalogue / roster / settings) ---');
  check('kitchen of A: write customer DENIED', await request('PATCH', 'customers', 'CUS-SHOP-A', withShop(validCustomer('CUS-SHOP-A'), 'shp_alpha'), MEMBER_A_KITCHEN), 'DENIED');
  check('cashier of A: write customer ALLOWED', await request('PATCH', 'customers', 'CUS-SHOP-A', withShop(validCustomer('CUS-SHOP-A'), 'shp_alpha'), JOINER), 'ALLOWED');
  check('kitchen of A: write product DENIED', await request('PATCH', 'products', 'PRD-SHOP-A', withShop(validProduct('PRD-SHOP-A'), 'shp_alpha'), MEMBER_A_KITCHEN), 'DENIED');
  check('admin of A: write product ALLOWED', await request('PATCH', 'products', 'PRD-SHOP-A', withShop(validProduct('PRD-SHOP-A'), 'shp_alpha'), OWNER_A), 'ALLOWED');
  check('admin of A: write product of shop B DENIED', await request('PATCH', 'products', 'PRD-SHOP-AB', withShop(validProduct('PRD-SHOP-AB'), 'shp_beta'), OWNER_A), 'DENIED');
  check('admin of A: write roster ALLOWED', await request('PATCH', 'users', 'u-roster-a', withShop(validUser('u-roster-a'), 'shp_alpha'), OWNER_A), 'ALLOWED');
  check('cashier of A: write roster DENIED', await request('PATCH', 'users', 'u-roster-a2', withShop(validUser('u-roster-a2'), 'shp_alpha'), JOINER), 'DENIED');
  check('admin of A: write roster of shop B DENIED', await request('PATCH', 'users', 'u-roster-b', withShop(validUser('u-roster-b'), 'shp_beta'), OWNER_A), 'DENIED');
  // NOTE: `settings/bankConfig` is a FIXED document id shared by every shop
  // in a flat collection — so P3 must namespace ids per shop
  // (`${shopId}-bankConfig`). Rules: only the super-admin may adopt such a
  // pre-tenancy path into a shop (the P2 backfill), a shop admin may not.
  check('shop admin cannot adopt a legacy path (id collision)', await request('PATCH', 'settings', 'bankConfig', withShop(validSetting, 'shp_alpha'), OWNER_A), 'DENIED');
  check('super-admin adopts legacy path into shop A (P2 backfill)', await request('PATCH', 'settings', 'bankConfig', withShop(validSetting, 'shp_alpha'), BOOTSTRAP), 'ALLOWED');
  check('admin of A: own bank config readable', await request('GET', 'settings', 'bankConfig', null, OWNER_A), 'ALLOWED');
  check('admin of B: bank config of shop A DENIED', await request('GET', 'settings', 'bankConfig', null, OWNER_B), 'DENIED');
  check('admin of A: write bank config of shop B DENIED', await request('PATCH', 'settings', 'bankConfig', withShop(validSetting, 'shp_beta'), OWNER_A), 'DENIED');
  check('kitchen of A: write bank config DENIED', await request('PATCH', 'settings', 'bankConfig', withShop(validSetting, 'shp_alpha'), MEMBER_A_KITCHEN), 'DENIED');

  console.log('\n--- 18. T1: invite lifecycle + archive ---');
  check('admin A lists own invite codes', await queryBy('inviteCodes', OWNER_A, 'shopId', 'shp_alpha'), 'ALLOWED');
  check('non-admin member cannot list invite codes', await queryBy('inviteCodes', JOINER, 'shopId', 'shp_alpha'), 'DENIED');
  check('outsider cannot list invite codes (filtered)', await queryBy('inviteCodes', STRANGER, 'shopId', 'shp_alpha'), 'DENIED');
  check('invite list without filter fails closed', await list('inviteCodes', OWNER_A), 'DENIED');
  check('admin A cannot mint a code for shop B', await request('PATCH', 'inviteCodes', 'OTHER99', invite('OTHER99', 'shp_beta'), OWNER_A), 'DENIED');
  check('admin A revokes the invite code', await request('DELETE', 'inviteCodes', 'INVITE01', null, OWNER_A), 'ALLOWED');
  check('revoked code no longer authorises a join', await request('PATCH', 'shops/shp_alpha/members', 'u-stranger', member('u-stranger', 'shp_alpha', 'CASHIER', 'pending', { inviteCode: 'INVITE01' }), STRANGER), 'DENIED');
  check('owner archives own shop', await request('PATCH', 'shops', 'shp_alpha', { ...shop('shp_alpha', 'u-owner-a', 'ownera@example.com'), status: 'archived' }, OWNER_A), 'ALLOWED');
  check('non-admin member cannot edit the shop', await request('PATCH', 'shops', 'shp_alpha', { ...shop('shp_alpha', 'u-owner-a', 'ownera@example.com'), status: 'active' }, MEMBER_A_KITCHEN), 'DENIED');
  check('owner cannot transfer ownership', await request('PATCH', 'shops', 'shp_alpha', { ...shop('shp_alpha', 'u-stranger', 'ownera@example.com'), ownerUid: 'u-stranger' }, OWNER_A), 'DENIED');
  check('outsider cannot edit a shop', await request('PATCH', 'shops', 'shp_beta', { ...shop('shp_beta', 'u-owner-b', 'ownerb@example.com', 'JOINB01'), name: 'Pwned' }, STRANGER), 'DENIED');

  console.log('\n--- 19. T1: legacy single-tenant branch cannot leak shop docs ---');
  check('legacy role holder: read shop-scoped doc DENIED', await request('GET', 'orders', 'ORD-SHOP-B', null, KITCHEN), 'DENIED');
  check('legacy role holder: unfiltered list DENIED', await list('orders', KITCHEN), 'DENIED');
  check('legacy role holder: filtered list DENIED (no membership)', await queryBy('orders', KITCHEN, 'shopId', 'shp_alpha'), 'DENIED');
  check('legacy role holder: write shop-scoped doc DENIED', await request('PATCH', 'orders', 'ORD-SHOP-Z', withShop(validOrder('ORD-SHOP-Z'), 'shp_alpha'), KITCHEN), 'DENIED');
  check('legacy single-tenant doc still readable by role', await request('GET', 'orders', 'ORD-TEST-1', null, KITCHEN), 'ALLOWED');

  console.log('\n--- 20. T1: revoking membership removes access immediately ---');
  check('admin revokes shop A kitchen', await request('DELETE', 'shops/shp_alpha/members', 'u-mem-a-kitchen', null, OWNER_A), 'ALLOWED');
  check('revoked member: read own-shop order', await request('GET', 'orders', 'ORD-SHOP-A', null, MEMBER_A_KITCHEN), 'DENIED');
  check('revoked member: write own-shop order', await request('PATCH', 'orders', 'ORD-SHOP-A', { ...orderA, deliveryStatus: 'DELIVERED' }, MEMBER_A_KITCHEN), 'DENIED');
  check('revoked member: list own shop', await queryBy('orders', MEMBER_A_KITCHEN, 'shopId', 'shp_alpha'), 'DENIED');
  check('revoked member: read member roster', await list('shops/shp_alpha/members', MEMBER_A_KITCHEN), 'DENIED');

  console.log('\n--- 21. T1: admin deletes only inside own shop (destructive, runs last) ---');
  check('kitchen of A: delete order DENIED', await request('DELETE', 'orders', 'ORD-SHOP-A', null, MEMBER_A_KITCHEN), 'DENIED');
  check('admin of A: delete own-shop order ALLOWED', await request('DELETE', 'orders', 'ORD-SHOP-A', null, OWNER_A), 'ALLOWED');
  check('admin of A: delete order of shop B DENIED', await request('DELETE', 'orders', 'ORD-SHOP-B', null, OWNER_A), 'DENIED');
  check('super-admin: delete order of any shop ALLOWED', await request('DELETE', 'orders', 'ORD-SHOP-B', null, BOOTSTRAP), 'ALLOWED');
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
