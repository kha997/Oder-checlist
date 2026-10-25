import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * P2 (docs/MULTI-TENANT-SPEC.md §9): the cloud layer gains a shop scope.
 *
 * Two things must hold, and both are invisible from the outside because the
 * scope ships switched off:
 *
 * 1. once a shop is active, NO write escapes without its `shopId` and NO query
 *    escapes without `where('shopId', '==', …)` — the P4 rules deny anything
 *    else, so a missed call site would fail closed, not leak a shop's data;
 * 2. with no shop active, behaviour is byte-identical to the single-tenant app.
 *
 * Firestore is mocked module-wide; `vi.hoisted` keeps the mock state reachable
 * from the factory below (factories are hoisted above imports).
 */
const m = vi.hoisted(() => {
  type DocData = Record<string, any>;
  return {
    docsByCollection: {} as Record<string, Array<{ id: string; data: DocData }>>,
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    onSnapshot: vi.fn(),
    where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
    query: vi.fn((col: unknown, ...constraints: unknown[]) => ({
      kind: 'query',
      col,
      constraints,
    })),
    collection: vi.fn((_db: unknown, name: string) => ({ kind: 'collection', name })),
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({
      kind: 'doc',
      // Variadic so nested paths (`shops/{sid}/members/{uid}`) stay visible.
      path: segments.filter(Boolean).join('/'),
    })),
    handleFirestoreError: vi.fn(),
    /** Default `getDocs`: serve whatever the test seeded for that collection. */
    defaultGetDocs: undefined as unknown as (ref: { name: string }) => Promise<any>,
  };
});

vi.mock('firebase/firestore', () => ({
  collection: m.collection,
  doc: m.doc,
  setDoc: m.setDoc,
  updateDoc: m.updateDoc,
  deleteDoc: m.deleteDoc,
  getDoc: m.getDoc,
  getDocs: m.getDocs,
  onSnapshot: m.onSnapshot,
  query: m.query,
  where: m.where,
}));

vi.mock('../config', () => ({
  db: {},
  OperationType: {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LIST: 'list',
    GET: 'get',
    WRITE: 'write',
  },
  handleFirestoreError: m.handleFirestoreError,
}));

import {
  BACKFILL_COLLECTIONS,
  adoptLocalDocumentsIntoShop,
  backfillShopId,
  createShop,
  generateInviteCode,
  generateShopId,
  getActiveShopId,
  joinShop,
  migrateLegacyStaffRolesToMembers,
  probeAccount,
  seedLocalDataToFirestoreIfEmpty,
  setActiveShopId,
  shopScopedCollection,
  subscribeToFirebaseCollections,
  upsertBankConfigFirestore,
  upsertOrderFirestore,
  upsertProductFirestore,
  updateOrderFirestore,
  upsertStaffUserFirestore,
} from '../firestoreService';
import { type Order, type Product, type StaffUser, type Customer } from '../../types';

const order = (id: string): Order => ({
  id,
  createdAt: '2026-10-25T00:00:00.000Z',
  customerName: 'Lan',
  items: [],
  totalAmount: 150000,
  location: { type: 'condo', condoName: 'Sunrise City', formattedAddress: 'B-20-10' },
  deliveryStatus: 'PENDING',
  paymentStatus: 'UNPAID',
  status: 'ACTIVE',
});

const product = (id: string): Product => ({
  id,
  name: 'Mi',
  price: 30000,
  initialStock: 10,
  stockReceived: 0,
  quantitySold: 0,
  currentStock: 10,
  unit: 'Phần',
});

const staffUser = (id: string): StaffUser => ({
  id,
  name: 'An',
  role: 'CASHIER',
  active: true,
  createdAt: '2026-10-25T00:00:00.000Z',
});

/** Seed a collection's docs as `getDocs` should return them. */
const seedCollection = (name: string, docs: Array<{ id: string; data: Record<string, any> }>) => {
  m.docsByCollection[name] = docs;
};

beforeEach(() => {
  for (const key of Object.keys(m.docsByCollection)) delete m.docsByCollection[key];
  m.setDoc.mockReset();
  m.updateDoc.mockReset().mockResolvedValue(undefined);
  m.deleteDoc.mockReset().mockResolvedValue(undefined);
  m.getDoc.mockReset().mockResolvedValue({ exists: () => false });
  m.onSnapshot.mockReset().mockImplementation(() => () => {});
  m.where.mockClear();
  m.query.mockClear();
  m.collection.mockClear();
  m.handleFirestoreError.mockClear();
  setActiveShopId(null);

  m.defaultGetDocs = async (ref: { name: string }) => {
    const docs = (m.docsByCollection[ref.name] ?? []).map((d) => ({
      id: d.id,
      ref: { path: `${ref.name}/${d.id}` },
      data: () => d.data,
    }));
    return { docs, empty: docs.length === 0, forEach: (fn: (d: unknown) => void) => docs.forEach(fn) };
  };
  m.getDocs.mockReset().mockImplementation(m.defaultGetDocs);
});

afterEach(() => {
  setActiveShopId(null);
});

describe('shop scope', () => {
  it('is off by default — the pre-tenancy behaviour, unchanged', () => {
    expect(getActiveShopId()).toBeNull();
    const col = shopScopedCollection('orders');
    expect(col).toEqual({ kind: 'collection', name: 'orders' });
    expect(m.where).not.toHaveBeenCalled();
  });

  it('rejects a bare null/undefined activation rather than widening scope', () => {
    setActiveShopId(undefined as unknown as string);
    expect(getActiveShopId()).toBeNull();
    setActiveShopId('shp_a');
    expect(getActiveShopId()).toBe('shp_a');
  });

  it('stamps the active shop on every document write', async () => {
    setActiveShopId('shp_a');

    await upsertOrderFirestore(order('ORD-1'));
    const payload = m.setDoc.mock.calls.at(-1)![1] as Record<string, any>;
    expect(payload.shopId).toBe('shp_a');
    expect(payload.id).toBe('ORD-1');

    // Partial updates stamp too: the rules reject an update whose incoming
    // document carries no shopId.
    await updateOrderFirestore('ORD-1', { deliveryStatus: 'DELIVERED' });
    const patch = m.updateDoc.mock.calls.at(-1)![1] as Record<string, any>;
    expect(patch.shopId).toBe('shp_a');

    // Staff and catalogue writes share the invariant.
    await upsertProductFirestore(product('prod-1'));
    await upsertStaffUserFirestore(staffUser('staff-1'));
    expect(
      (m.setDoc.mock.calls.at(-2)![1] as Record<string, any>).shopId
    ).toBe('shp_a');
    expect(
      (m.setDoc.mock.calls.at(-1)![1] as Record<string, any>).shopId
    ).toBe('shp_a');
  });

  it('adds no shopId while no shop is active', async () => {
    await upsertOrderFirestore(order('ORD-2'));
    const payload = m.setDoc.mock.calls.at(-1)![1] as Record<string, any>;
    expect(payload).not.toHaveProperty('shopId');
  });

  it('P3: namespaces settings per shop and stamps it (bank details are tenant data)', async () => {
    setActiveShopId('shp_a');
    await upsertBankConfigFirestore({
      bankBin: '970422',
      bankCode: 'MB',
      bankName: 'MBBank',
      accountNumber: '0901234567',
      accountHolder: 'CHU SHOP HOA',
      qrTemplate: 'compact2',
    });
    // P3 gives each shop its OWN settings document — a fixed global id would
    // let shop B overwrite (and pre-rules, read) shop A's bank details.
    expect(m.doc.mock.calls.at(-1)![1]).toBe('settings');
    expect(m.doc.mock.calls.at(-1)![2]).toBe('shp_a-bankConfig');
    // …and stamps it, because members read it through `shopId` (the rules'
    // legacy read branch requires `staffRoles`, which members don't have).
    expect((m.setDoc.mock.calls.at(-1)![1] as Record<string, any>).shopId).toBe('shp_a');

    // No scope → the legacy global id, un-stamped: byte-identical to the
    // single-tenant app.
    setActiveShopId(null);
    await upsertBankConfigFirestore({
      bankBin: '970422',
      bankCode: 'MB',
      bankName: 'MBBank',
      accountNumber: '0901234567',
      accountHolder: 'CHU SHOP HOA',
      qrTemplate: 'compact2',
    });
    expect(m.doc.mock.calls.at(-1)![2]).toBe('bankConfig');
    expect(m.setDoc.mock.calls.at(-1)![1]).not.toHaveProperty('shopId');
  });

  it('scopes every subscription query to the active shop', () => {
    setActiveShopId('shp_a');
    const unsub = subscribeToFirebaseCollections({});

    // orders, customers, products, condos, stockLogs, users — settings is a
    // single document read (no query to scope).
    expect(m.where).toHaveBeenCalledTimes(6);
    for (const call of m.where.mock.calls) {
      expect(call).toEqual(['shopId', '==', 'shp_a']);
    }

    unsub();
    // 6 collection subscriptions + the single `settings/bankConfig` doc read,
    // which is a path (P3 namespaces it) rather than a query to scope.
    expect(m.onSnapshot).toHaveBeenCalledTimes(7);
    for (const call of m.onSnapshot.mock.calls) {
      expect(call[0]).toBeDefined();
    }
  });

  it('keeps queries unfiltered while no shop is active', () => {
    subscribeToFirebaseCollections({});
    expect(m.where).not.toHaveBeenCalled();
    expect(m.query).not.toHaveBeenCalled();
    expect(m.onSnapshot).toHaveBeenCalledTimes(7);
  });
});

describe('backfillShopId', () => {
  it('refuses to stamp into the void', async () => {
    await expect(backfillShopId('')).rejects.toThrow(/shopId/);
    await expect(backfillShopId('   ')).rejects.toThrow(/shopId/);
    expect(m.updateDoc).not.toHaveBeenCalled();
  });

  it('stamps only un-owned documents and is idempotent', async () => {
    seedCollection('orders', [
      { id: 'ORD-legacy', data: { id: 'ORD-legacy', totalAmount: 1 } },
      { id: 'ORD-owned', data: { id: 'ORD-owned', shopId: 'shp_alpha' } },
      { id: 'ORD-empty', data: { id: 'ORD-empty', shopId: '' } },
    ]);
    seedCollection('customers', []);

    const first = await backfillShopId('shp_alpha');
    const orders = first.find((r) => r.collection === 'orders')!;
    expect(orders).toMatchObject({ scanned: 3, updated: 2 });
    expect(orders.error).toBeUndefined();
    expect(m.updateDoc).toHaveBeenCalledTimes(2);
    for (const call of m.updateDoc.mock.calls) {
      expect(call[1]).toEqual({ shopId: 'shp_alpha' });
    }

    // Re-run against the now-stamped data: a no-op, not a rewrite.
    m.updateDoc.mockClear();
    seedCollection('orders', [
      { id: 'ORD-legacy', data: { id: 'ORD-legacy', shopId: 'shp_alpha' } },
      { id: 'ORD-owned', data: { id: 'ORD-owned', shopId: 'shp_alpha' } },
      { id: 'ORD-empty', data: { id: 'ORD-empty', shopId: 'shp_alpha' } },
    ]);
    const second = await backfillShopId('shp_alpha');
    expect(second.find((r) => r.collection === 'orders')).toMatchObject({
      scanned: 3,
      updated: 0,
    });
    expect(m.updateDoc).not.toHaveBeenCalled();
  });

  it('never reassigns a document that already belongs to another shop', async () => {
    seedCollection('orders', [{ id: 'ORD-1', data: { id: 'ORD-1', shopId: 'shp_beta' } }]);

    const results = await backfillShopId('shp_alpha');
    expect(results.find((r) => r.collection === 'orders')).toMatchObject({
      scanned: 1,
      updated: 0,
    });
    expect(m.updateDoc).not.toHaveBeenCalled();
  });

  it('reports an error for a failing collection but keeps going', async () => {
    seedCollection('orders', [{ id: 'ORD-1', data: { id: 'ORD-1' } }]);
    m.getDocs.mockImplementation(async (ref: { name: string }) => {
      if (ref.name === 'customers') throw new Error('permission denied');
      return m.defaultGetDocs(ref);
    });

    const results = await backfillShopId('shp_alpha');

    expect(results.map((r) => r.collection)).toEqual(BACKFILL_COLLECTIONS);
    const customers = results.find((r) => r.collection === 'customers')!;
    expect(customers.error).toBe('permission denied');
    // The failure must not abort the run — a half-stamped dataset is
    // recoverable by re-running, an aborted one looks like a finished job.
    expect(results.find((r) => r.collection === 'orders')).toMatchObject({ updated: 1 });
    expect(results.filter((r) => r.error)).toHaveLength(1);
  });

  it('covers every cloud collection', async () => {
    expect(BACKFILL_COLLECTIONS).toEqual([
      'orders',
      'customers',
      'products',
      'condos',
      'stockLogs',
      'users',
      'settings',
    ]);
    const results = await backfillShopId('shp_alpha');
    expect(results).toHaveLength(7);
    for (const r of results) {
      expect(r.error).toBeUndefined();
      expect(r.scanned).toBe(0);
    }
  });
});

// ===========================================================================
// P3 (docs/MULTI-TENANT-SPEC.md §9): self-serve tenancy — probe, onboarding
// writes, adoption, prefixed seed, staffRoles → members migration.
// ===========================================================================

describe('probeAccount (which rules generation is live)', () => {
  it('sees the tenancy rules when the account index exists', async () => {
    m.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ uid: 'u1', email: 'a@x.com', displayName: 'A', shops: ['shp_a'], defaultShopId: 'shp_a' }),
    });
    expect(await probeAccount('u1')).toEqual({
      mode: 'tenancy',
      account: { uid: 'u1', email: 'a@x.com', displayName: 'A', shops: ['shp_a'], defaultShopId: 'shp_a' },
    });
  });

  it('sees the tenancy rules with no account — a fresh visitor', async () => {
    m.getDoc.mockResolvedValueOnce({ exists: () => false });
    expect(await probeAccount('u1')).toEqual({ mode: 'tenancy', account: null });
  });

  it('detects the OLD single-tenant rules through permission-denied', async () => {
    m.getDoc.mockRejectedValueOnce(
      Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' })
    );
    expect(await probeAccount('u1')).toEqual({ mode: 'legacy' });
  });

  it('never mis-classifies a network failure as legacy (would hide the shop)', async () => {
    m.getDoc.mockRejectedValueOnce(new Error('Failed to get document because the server is unavailable.'));
    await expect(probeAccount('u1')).rejects.toThrow(/unavailable/);
  });
});

describe('id generators match firestore.rules', () => {
  it('generateShopId satisfies validShopId (4–64, [a-zA-Z0-9_-])', () => {
    for (let i = 0; i < 25; i += 1) {
      const id = generateShopId();
      expect(id).toMatch(/^shp_[a-zA-Z0-9_-]{4,64}$/);
    }
  });

  it('generateInviteCode satisfies ^[A-Z0-9]+$ and 6–32 chars', () => {
    for (let i = 0; i < 25; i += 1) {
      const code = generateInviteCode();
      expect(code).toMatch(/^[A-Z0-9]{6,32}$/);
      expect(code).toHaveLength(8);
    }
  });
});

describe('createShop', () => {
  const params = {
    ownerUid: 'u1',
    ownerEmail: 'a@example.com',
    ownerDisplayName: 'A',
    name: 'Cơ sở A',
  };

  it('writes in the order the rules require — index grown LAST', async () => {
    m.getDoc.mockResolvedValue({ exists: () => false });

    const res = await createShop(params);
    expect(res.shopId).toMatch(/^shp_/);
    expect(res.inviteCode).toMatch(/^[A-Z0-9]{6,32}$/);

    const paths = m.setDoc.mock.calls.map((c) => String(c[0].path));
    expect(paths).toEqual([
      `accounts/${params.ownerUid}`, // 1. index exists with shops: [] (the guard reads it)
      `shops/${res.shopId}`, //          2. shop — guard proves shops.size() == 0
      `shops/${res.shopId}/members/${params.ownerUid}`, // 3. self ADMIN seat (branch a)
      `inviteCodes/${res.inviteCode}`, // 4. needs admin membership from step 3
      `accounts/${params.ownerUid}`, //   5. grow — ONLY after everything else succeeded
    ]);
    // The grow is a merge write so the never-shrink rule sees the union.
    expect(m.setDoc.mock.calls[4][2]).toEqual({ merge: true });
    expect(m.setDoc.mock.calls[4][1]).toMatchObject({
      shops: [res.shopId],
      defaultShopId: res.shopId,
      pendingShops: [],
    });
    expect(m.setDoc.mock.calls[2][1]).toMatchObject({
      uid: params.ownerUid,
      shopId: res.shopId,
      role: 'ADMIN',
      status: 'active',
    });
    expect(m.setDoc.mock.calls[3][1]).toMatchObject({
      code: res.inviteCode,
      shopId: res.shopId,
      createdBy: params.ownerUid,
    });
  });

  it('refuses a second shop (1 per account, server-enforced)', async () => {
    m.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ uid: 'u1', shops: ['shp_old'], defaultShopId: 'shp_old' }),
    });
    await expect(createShop(params)).rejects.toThrow(/1 cửa hàng/);
    expect(m.setDoc).not.toHaveBeenCalled();
  });

  it('regenerates the invite code when it is already taken', async () => {
    let reads = 0;
    m.getDoc.mockImplementation(async () => {
      reads += 1;
      // read 1 = account (missing), read 2 = invite (taken), read 3 = free
      return { exists: () => reads >= 2 && reads <= 2 };
    });

    const res = await createShop(params);
    expect(reads).toBe(3);
    const inviteWrites = m.setDoc.mock.calls.filter((c) => String(c[0].path).startsWith('inviteCodes/'));
    expect(inviteWrites).toHaveLength(1);
    expect(String(inviteWrites[0][0].path)).toBe(`inviteCodes/${res.inviteCode}`);
  });
});

describe('joinShop', () => {
  it('rejects an unknown invite code before touching anything', async () => {
    m.getDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(
      joinShop({ uid: 'u2', email: 'b@example.com', displayName: 'B', inviteCode: 'NOPE123' })
    ).rejects.toThrow(/Mã mời/);
    expect(m.setDoc).not.toHaveBeenCalled();
  });

  it('creates a PENDING seat backed by the invite; index only gets pendingShops', async () => {
    m.getDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ code: 'INVITE01', shopId: 'shp_a', createdBy: 'u1', createdAt: 'x' }),
      })
      .mockResolvedValueOnce({ exists: () => false }) // member doc — none yet
      .mockResolvedValueOnce({ exists: () => false }); // account — none yet

    const res = await joinShop({
      uid: 'u2',
      email: 'b@example.com',
      displayName: 'B',
      inviteCode: 'invite01', // lower-case input, normalised to the rules' A–Z0–9
    });
    expect(res.shopId).toBe('shp_a');

    const memberWrite = m.setDoc.mock.calls.find((c) => String(c[0].path).includes('/members/'))!;
    expect(memberWrite[1]).toMatchObject({
      uid: 'u2',
      shopId: 'shp_a',
      status: 'pending',
      role: 'CASHIER',
      inviteCode: 'INVITE01',
    });
    const acctWrite = m.setDoc.mock.calls.find((c) => String(c[0].path) === 'accounts/u2')!;
    // pendingShops only — a rejected join must never grant navigation rights.
    expect(acctWrite[1]).toMatchObject({ shops: [], pendingShops: ['shp_a'] });
  });

  it('heals the index when membership is already active (no member rewrite)', async () => {
    m.getDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ code: 'INVITE01', shopId: 'shp_a', createdBy: 'u1', createdAt: 'x' }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          uid: 'u2',
          shopId: 'shp_a',
          email: 'b@example.com',
          displayName: 'B',
          role: 'CASHIER',
          status: 'active',
          createdAt: 'x',
        }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          uid: 'u2',
          email: 'b@example.com',
          displayName: 'B',
          shops: [],
          defaultShopId: '',
          pendingShops: ['shp_a'],
        }),
      });

    await joinShop({ uid: 'u2', email: 'b@example.com', displayName: 'B', inviteCode: 'INVITE01' });

    // Only the index grows — writing the member doc would be an update by a
    // non-admin, which the rules deny.
    expect(m.setDoc).toHaveBeenCalledTimes(1);
    expect(m.setDoc.mock.calls[0][1]).toMatchObject({
      shops: ['shp_a'],
      defaultShopId: 'shp_a',
      pendingShops: [],
    });
    expect(m.updateDoc).not.toHaveBeenCalled();
    expect(m.deleteDoc).not.toHaveBeenCalled();
  });
});

describe('adoptLocalDocumentsIntoShop', () => {
  it('classifies adopted / missing / denied and stamps only successes', async () => {
    m.updateDoc.mockReset().mockImplementation(async (ref: { path: string }) => {
      if (ref.path.startsWith('orders/ORD-missing')) {
        throw Object.assign(new Error('no doc'), { code: 'not-found' });
      }
      if (ref.path.startsWith('customers/CUS-denied')) {
        throw Object.assign(new Error('denied'), { code: 'permission-denied' });
      }
      return undefined;
    });

    const res = await adoptLocalDocumentsIntoShop('shp_a', {
      orders: ['ORD-ok', 'ORD-missing'],
      customers: ['CUS-denied'],
      products: ['PRD-ok'],
    });

    expect(res.adopted).toBe(2);
    const byColl = Object.fromEntries(res.results.map((r) => [r.collection, r]));
    expect(byColl.orders).toMatchObject({ attempted: 2, adopted: 1, missing: 1, denied: 0 });
    expect(byColl.customers).toMatchObject({ attempted: 1, adopted: 0, denied: 1 });
    expect(byColl.products).toMatchObject({ attempted: 1, adopted: 1 });
    expect(byColl.users).toMatchObject({ attempted: 0 });
    for (const call of m.updateDoc.mock.calls) {
      expect(call[1]).toEqual({ shopId: 'shp_a' });
    }

    await expect(adoptLocalDocumentsIntoShop('', {})).rejects.toThrow(/shopId/);
  });
});

describe('seed id prefixing (no cross-shop collision)', () => {
  const customer = (id: string): Customer => ({
    id,
    name: 'Lan',
    phone: '0901234567',
    defaultLocationType: 'condo',
  });

  it('a scoped seed rewrites ids AND their references with the shop prefix', async () => {
    setActiveShopId('shp_a');
    const log = {
      id: 'LOG-1',
      productId: 'prod-1',
      productName: 'Mi',
      quantityAdded: 5,
      date: '2026-10-25',
    };

    await seedLocalDataToFirestoreIfEmpty({
      orders: [
        {
          ...order('ORD-1'),
          items: [
            { productId: 'prod-1', productName: 'Mi', quantity: 1, unitPrice: 30000, lineTotal: 30000, unit: 'Phần' },
          ],
          recurringParentOrderId: 'ORD-0',
        },
      ],
      customers: [customer('CUS-1')],
      products: [product('prod-1')],
      condos: [{ id: 'condo-1', name: 'Sunrise', blocks: ['A'] }],
      stockLogs: [log],
      staffUsers: [staffUser('staff-1')],
    });

    const byPath = (prefix: string) =>
      m.setDoc.mock.calls.find((c) => String(c[0].path).startsWith(prefix))!;

    const orderWrite = byPath('orders/');
    expect(orderWrite[0].path).toBe('orders/shp_a-ORD-1');
    expect((orderWrite[1] as any).items[0].productId).toBe('shp_a-prod-1');
    expect((orderWrite[1] as any).recurringParentOrderId).toBe('shp_a-ORD-0');

    const prodWrite = byPath('products/');
    expect(prodWrite[0].path).toBe('products/shp_a-prod-1');
    expect((prodWrite[1] as any).shopId).toBe('shp_a');

    const logWrite = byPath('stockLogs/');
    expect(logWrite[0].path).toBe('stockLogs/shp_a-LOG-1');
    expect((logWrite[1] as any).productId).toBe('shp_a-prod-1');

    expect(byPath('customers/')[0].path).toBe('customers/shp_a-CUS-1');
    expect(byPath('users/')[0].path).toBe('users/shp_a-staff-1');
  });

  it('without a scope the seed is byte-identical to the single-tenant app', async () => {
    await seedLocalDataToFirestoreIfEmpty({
      orders: [order('ORD-1')],
      customers: [],
      products: [product('prod-1')],
      condos: [],
      stockLogs: [],
    });
    const paths = m.setDoc.mock.calls.map((c) => String(c[0].path));
    expect(paths).toContain('orders/ORD-1');
    expect(paths).toContain('products/prod-1');
    expect(paths.some((p) => p.includes('shp_'))).toBe(false);
  });
});

describe('migrateLegacyStaffRolesToMembers', () => {
  it('no-ops when staffRoles cannot be listed (fresh, non-admin owner)', async () => {
    m.getDocs.mockRejectedValueOnce(new Error('permission denied'));
    const res = await migrateLegacyStaffRolesToMembers('shp_a');
    expect(res).toEqual({ migrated: 0, provisioned: 0, skipped: 0, failed: 0 });
    expect(m.setDoc).not.toHaveBeenCalled();
  });

  it('copies roles into active member seats and provisions the index', async () => {
    seedCollection('staffRoles', [
      { id: 'u1', data: { uid: 'u1', email: 'a@x.com', displayName: 'A', role: 'ADMIN', createdAt: 'x' } },
      { id: 'u2', data: { uid: 'u2', email: 'b@x.com', displayName: 'B', role: 'KITCHEN', createdAt: 'x' } },
    ]);

    const res = await migrateLegacyStaffRolesToMembers('shp_a');
    expect(res).toMatchObject({ migrated: 2, provisioned: 2, skipped: 0, failed: 0 });

    const memberWrites = m.setDoc.mock.calls.filter((c) => String(c[0].path).includes('/members/'));
    expect(memberWrites).toHaveLength(2);
    expect(memberWrites[0][1]).toMatchObject({
      uid: 'u1',
      shopId: 'shp_a',
      role: 'ADMIN',
      status: 'active',
    });
    expect(memberWrites[1][1]).toMatchObject({ uid: 'u2', role: 'KITCHEN', status: 'active' });

    const acctWrites = m.setDoc.mock.calls.filter((c) => String(c[0].path).startsWith('accounts/'));
    expect(acctWrites).toHaveLength(2);
    expect(acctWrites[1][1]).toMatchObject({ uid: 'u2', shops: ['shp_a'], defaultShopId: 'shp_a' });
  });

  it('never clobbers an existing seat or index (idempotent)', async () => {
    seedCollection('staffRoles', [
      { id: 'u1', data: { uid: 'u1', email: 'a@x.com', displayName: 'A', role: 'ADMIN', createdAt: 'x' } },
    ]);
    m.getDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ uid: 'u1', shopId: 'shp_a', role: 'ADMIN', status: 'active' }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ uid: 'u1', shops: ['shp_a'], defaultShopId: 'shp_a' }),
      });

    const res = await migrateLegacyStaffRolesToMembers('shp_a');
    expect(res).toMatchObject({ migrated: 0, provisioned: 0, skipped: 1, failed: 0 });
    expect(m.setDoc).not.toHaveBeenCalled();
  });
});
