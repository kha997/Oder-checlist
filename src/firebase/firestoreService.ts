import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { type Order, type Customer, type Product, type CondoLocation, type StockLog, type StaffUser, type StoreBankConfig, type UserRole } from '../types';

export interface FirebaseSyncCallbacks {
  onOrdersChange?: (orders: Order[]) => void;
  onCustomersChange?: (customers: Customer[]) => void;
  onProductsChange?: (products: Product[]) => void;
  onCondosChange?: (condos: CondoLocation[]) => void;
  onStockLogsChange?: (stockLogs: StockLog[]) => void;
  onStaffChange?: (staff: StaffUser[]) => void;
  onBankConfigChange?: (config: StoreBankConfig) => void;
  onError?: (error: unknown) => void;
}

// Clean object helper to strip undefined fields before Firestore write
function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = sanitizeForFirestore(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Shop scope (T1 multi-tenancy, see docs/MULTI-TENANT-SPEC.md)
//
// P2 ships the MECHANISM with the scope switched OFF: `activeShopId` stays
// null until P3 selects a shop, so every call below behaves exactly like the
// single-tenant app it replaces. What P2 adds is the invariant itself — once a
// shop is active, NO cloud write escapes without its `shopId` and NO cloud read
// escapes without `where('shopId')`. The P4 rules deny anything that does, so
// "forgot to scope" fails closed rather than leaking another shop's data.
// ---------------------------------------------------------------------------

let activeShopId: string | null = null;

/** Select the shop all cloud reads/writes are scoped to. null = pre-tenancy. */
export function setActiveShopId(shopId: string | null): void {
  activeShopId = shopId ?? null;
}

export function getActiveShopId(): string | null {
  return activeShopId;
}

/**
 * A collection narrowed to the active shop. Returns the plain collection when
 * no shop is active — the legacy behaviour, byte-for-byte.
 */
export function shopScopedCollection(name: string) {
  const col = collection(db, name);
  return activeShopId ? query(col, where('shopId', '==', activeShopId)) : col;
}

/**
 * A single-document collection's id narrowed to the active shop. `settings`
 * used to be a fixed global id (`bankConfig`) shared by every shop — P3
 * namespaces it per shop (`{shopId}-bankConfig`) so two shops can never read
 * or write each other's bank details. No scope = the legacy global id.
 */
export function shopScopedDocId(baseId: string): string {
  return activeShopId ? `${activeShopId}-${baseId}` : baseId;
}

/**
 * Attach the active shop's id to an outgoing document. The active scope is
 * authoritative: a stale `shopId` on an incoming object must never re-home a
 * document to another shop (the rules deny that write anyway — this keeps the
 * client from attempting it).
 *
 * NOT applied to `settings`: its doc id is namespaced per shop instead
 * (`{shopId}-bankConfig`, see `shopScopedDocId`) and the id already carries
 * the tenant, so `upsertBankConfigFirestore` stamps it explicitly.
 */
function withShopId(data: Record<string, any>): Record<string, any> {
  const base = sanitizeForFirestore(data);
  return activeShopId ? { ...base, shopId: activeShopId } : base;
}

/**
 * Subscribes to all real-time Firestore collections.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToFirebaseCollections(callbacks: FirebaseSyncCallbacks): () => void {
  const unsubscribers: Unsubscribe[] = [];

  // 1. Orders
  try {
    const ordersCol = shopScopedCollection('orders');
    const unsubOrders = onSnapshot(
      ordersCol,
      (snapshot) => {
        const items: Order[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as Order);
        });
        callbacks.onOrdersChange?.(items);
      },
      (error) => {
        callbacks.onError?.(error);
        handleFirestoreError(error, OperationType.GET, 'orders');
      }
    );
    unsubscribers.push(unsubOrders);
  } catch (err) {
    callbacks.onError?.(err);
  }

  // 2. Customers
  try {
    const custCol = shopScopedCollection('customers');
    const unsubCust = onSnapshot(
      custCol,
      (snapshot) => {
        const items: Customer[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as Customer);
        });
        callbacks.onCustomersChange?.(items);
      },
      (error) => {
        callbacks.onError?.(error);
        handleFirestoreError(error, OperationType.GET, 'customers');
      }
    );
    unsubscribers.push(unsubCust);
  } catch (err) {
    callbacks.onError?.(err);
  }

  // 3. Products
  try {
    const prodCol = shopScopedCollection('products');
    const unsubProd = onSnapshot(
      prodCol,
      (snapshot) => {
        const items: Product[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as Product);
        });
        callbacks.onProductsChange?.(items);
      },
      (error) => {
        callbacks.onError?.(error);
        handleFirestoreError(error, OperationType.GET, 'products');
      }
    );
    unsubscribers.push(unsubProd);
  } catch (err) {
    callbacks.onError?.(err);
  }

  // 4. Condos
  try {
    const condosCol = shopScopedCollection('condos');
    const unsubCondos = onSnapshot(
      condosCol,
      (snapshot) => {
        const items: CondoLocation[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as CondoLocation);
        });
        callbacks.onCondosChange?.(items);
      },
      (error) => {
        callbacks.onError?.(error);
        handleFirestoreError(error, OperationType.GET, 'condos');
      }
    );
    unsubscribers.push(unsubCondos);
  } catch (err) {
    callbacks.onError?.(err);
  }

  // 5. Stock Logs
  try {
    const logsCol = shopScopedCollection('stockLogs');
    const unsubLogs = onSnapshot(
      logsCol,
      (snapshot) => {
        const items: StockLog[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as StockLog);
        });
        callbacks.onStockLogsChange?.(items);
      },
      (error) => {
        callbacks.onError?.(error);
        handleFirestoreError(error, OperationType.GET, 'stockLogs');
      }
    );
    unsubscribers.push(unsubLogs);
  } catch (err) {
    callbacks.onError?.(err);
  }

  // 6. Staff Users (RBAC)
  try {
    const staffCol = shopScopedCollection('users');
    const unsubStaff = onSnapshot(
      staffCol,
      (snapshot) => {
        const items: StaffUser[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.id && data.name && data.role) {
            items.push(data as StaffUser);
          }
        });
        if (items.length > 0) {
          callbacks.onStaffChange?.(items);
        }
      },
      (error) => {
        callbacks.onError?.(error);
        handleFirestoreError(error, OperationType.GET, 'users');
      }
    );
    unsubscribers.push(unsubStaff);
  } catch (err) {
    callbacks.onError?.(err);
  }

  // 7. Store Bank Config (VietQR)
  try {
    const bankDocRef = doc(db, 'settings', shopScopedDocId('bankConfig'));
    const unsubBank = onSnapshot(
      bankDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callbacks.onBankConfigChange?.(docSnap.data() as StoreBankConfig);
        }
      },
      (error) => {
        callbacks.onError?.(error);
        handleFirestoreError(error, OperationType.GET, 'settings/bankConfig');
      }
    );
    unsubscribers.push(unsubBank);
  } catch (err) {
    callbacks.onError?.(err);
  }

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

// ----------------- Write Operations -----------------

export async function upsertBankConfigFirestore(config: StoreBankConfig): Promise<void> {
  const docId = shopScopedDocId('bankConfig');
  try {
    const docRef = doc(db, 'settings', docId);
    // P3: with the id namespaced per shop, stamping is safe — and required:
    // the rules' read path for a shop-scoped document is
    // `resource.data.shopId == activeShop`, which an un-stamped document can
    // never satisfy for a plain member.
    const payload = activeShopId
      ? { ...sanitizeForFirestore(config), shopId: activeShopId }
      : sanitizeForFirestore(config);
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `settings/${docId}`);
  }
}

export async function upsertOrderFirestore(order: Order): Promise<void> {
  const path = `orders/${order.id}`;
  try {
    const docRef = doc(db, 'orders', order.id);
    await setDoc(docRef, withShopId(order), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateOrderFirestore(orderId: string, updates: Partial<Order>): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    const docRef = doc(db, 'orders', orderId);
    await updateDoc(docRef, withShopId(updates));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteOrderFirestore(orderId: string): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    const docRef = doc(db, 'orders', orderId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertCustomerFirestore(customer: Customer): Promise<void> {
  const path = `customers/${customer.id}`;
  try {
    const docRef = doc(db, 'customers', customer.id);
    await setDoc(docRef, withShopId(customer), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertProductFirestore(product: Product): Promise<void> {
  const path = `products/${product.id}`;
  try {
    const docRef = doc(db, 'products', product.id);
    await setDoc(docRef, withShopId(product), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertCondoFirestore(condo: CondoLocation): Promise<void> {
  const path = `condos/${condo.id}`;
  try {
    const docRef = doc(db, 'condos', condo.id);
    await setDoc(docRef, withShopId(condo), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function addStockLogFirestore(log: StockLog): Promise<void> {
  const path = `stockLogs/${log.id}`;
  try {
    const docRef = doc(db, 'stockLogs', log.id);
    await setDoc(docRef, withShopId(log), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertStaffUserFirestore(staff: StaffUser): Promise<void> {
  const path = `users/${staff.id}`;
  try {
    const docRef = doc(db, 'users', staff.id);
    // Full overwrite (no `merge`): staff records are always written as a
    // complete object, and this also drops any stale legacy field — notably
    // `pin`, which firestore.rules now rejects outright.
    await setDoc(docRef, withShopId(staff));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteStaffUserFirestore(staffId: string): Promise<void> {
  const path = `users/${staffId}`;
  try {
    const docRef = doc(db, 'users', staffId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ----------------- Role management (RBAC) -----------------

/**
 * A role assignment. The document id IS the Firebase Auth uid, and the rules
 * require the `uid` field to match it.
 */
export interface StaffRoleDoc {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

/**
 * A request for access. Deliberately has no `role` field — the rules reject
 * a document that carries one, so a user cannot promote themselves.
 */
export interface StaffRequestDoc {
  uid: string;
  email: string;
  displayName: string;
  requestedAt: string;
}

/**
 * The caller's assigned role, or null when they have none.
 *
 * A signed-in user without a role document has no access to any collection,
 * so this is also the gate for whether cloud sync can run at all.
 */
export async function getStaffRole(uid: string): Promise<StaffRoleDoc | null> {
  try {
    const snap = await getDoc(doc(db, 'staffRoles', uid));
    if (!snap.exists()) return null;
    return snap.data() as StaffRoleDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `staffRoles/${uid}`);
    return null;
  }
}

/** Every role assignment. Admin only — the rules deny this to anyone else. */
export async function listStaffRoles(): Promise<StaffRoleDoc[]> {
  try {
    const snap = await getDocs(collection(db, 'staffRoles'));
    return snap.docs.map((d) => d.data() as StaffRoleDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'staffRoles');
    return [];
  }
}

/** Assign (or change) a role. Admin only. */
export async function setStaffRole(role: StaffRoleDoc): Promise<void> {
  const path = `staffRoles/${role.uid}`;
  try {
    await setDoc(doc(db, 'staffRoles', role.uid), sanitizeForFirestore(role));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/** Revoke a role. Admin only. */
export async function deleteStaffRole(uid: string): Promise<void> {
  const path = `staffRoles/${uid}`;
  try {
    await deleteDoc(doc(db, 'staffRoles', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Ask for access. Any verified user may write their OWN request; the rules
 * reject a request that carries a `role` field.
 */
export async function requestStaffAccess(request: StaffRequestDoc): Promise<void> {
  const path = `staffRequests/${request.uid}`;
  try {
    await setDoc(doc(db, 'staffRequests', request.uid), sanitizeForFirestore(request));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/** Pending access requests. Admin only. */
export async function listStaffRequests(): Promise<StaffRequestDoc[]> {
  try {
    const snap = await getDocs(collection(db, 'staffRequests'));
    return snap.docs.map((d) => d.data() as StaffRequestDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'staffRequests');
    return [];
  }
}

/** Dismiss a request. Admin, or the requester themselves. */
export async function deleteStaffRequest(uid: string): Promise<void> {
  const path = `staffRequests/${uid}`;
  try {
    await deleteDoc(doc(db, 'staffRequests', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Collections the cloud layer knows about. Used to decide which ones the
 * signed-in role is allowed to write.
 */
export type CloudCollection =
  | 'orders'
  | 'customers'
  | 'products'
  | 'condos'
  | 'stockLogs'
  | 'users'
  | 'settings';

export interface SeedOptions {
  /**
   * Decides whether the signed-in role may write a collection. Collections
   * that are refused are skipped instead of failing the whole seed, because a
   * denied write aborts the remaining writes and would leave the cloud half
   * seeded.
   */
  canWrite?: (collection: CloudCollection) => boolean;
}

/**
 * Checks if Firestore collections are empty and optionally seeds current local dataset
 */
export async function seedLocalDataToFirestoreIfEmpty(
  data: {
    orders: Order[];
    customers: Customer[];
    products: Product[];
    condos: CondoLocation[];
    stockLogs: StockLog[];
    staffUsers?: StaffUser[];
  },
  options: SeedOptions = {}
): Promise<void> {
  const canWrite = options.canWrite ?? (() => true);
  const skip = (name: CloudCollection) => {
    if (canWrite(name)) return false;
    console.log(`Skipping seed of "${name}" — the current role may not write it.`);
    return true;
  };

  // P3: with a shop scope active, seeded documents get ids prefixed with the
  // shop id (`{shopId}-{localId}`). Without it, two shops both seeding the
  // local demo id `prod-1` would collide on one document — the second shop's
  // write is denied by the rules (silent data loss) or, worse, would have
  // overwritten the first shop's document pre-rules. Local state re-aligns
  // through the scoped subscription: it delivers the prefixed ids back in the
  // first snapshot after the seed. No scope = byte-identical legacy seeding.
  const seed = activeShopId ? prefixSeedData(data, (id) => `${activeShopId}-${id}`) : data;

  try {
    const ordersSnap = await getDocs(shopScopedCollection('orders'));
    if (ordersSnap.empty && seed.orders.length > 0 && !skip('orders')) {
      console.log('Seeding initial orders to Firestore...');
      for (const ord of seed.orders) {
        await upsertOrderFirestore(ord);
      }
    }

    const custSnap = await getDocs(shopScopedCollection('customers'));
    if (custSnap.empty && seed.customers.length > 0 && !skip('customers')) {
      console.log('Seeding initial customers to Firestore...');
      for (const c of seed.customers) {
        await upsertCustomerFirestore(c);
      }
    }

    const prodSnap = await getDocs(shopScopedCollection('products'));
    if (prodSnap.empty && seed.products.length > 0 && !skip('products')) {
      console.log('Seeding initial products to Firestore...');
      for (const p of seed.products) {
        await upsertProductFirestore(p);
      }
    }

    const condoSnap = await getDocs(shopScopedCollection('condos'));
    if (condoSnap.empty && seed.condos.length > 0 && !skip('condos')) {
      console.log('Seeding initial condos to Firestore...');
      for (const c of seed.condos) {
        await upsertCondoFirestore(c);
      }
    }

    const logsSnap = await getDocs(shopScopedCollection('stockLogs'));
    if (logsSnap.empty && seed.stockLogs.length > 0 && !skip('stockLogs')) {
      console.log('Seeding initial stock logs to Firestore...');
      for (const l of seed.stockLogs) {
        await addStockLogFirestore(l);
      }
    }

    if (seed.staffUsers && seed.staffUsers.length > 0 && !skip('users')) {
      const staffSnap = await getDocs(shopScopedCollection('users'));
      if (staffSnap.empty) {
        console.log('Seeding initial staff users to Firestore...');
        for (const u of seed.staffUsers) {
          await upsertStaffUserFirestore(u);
        }
      }
    }
  } catch (err) {
    console.warn('Initial seeding check skipped or deferred:', err);
  }
}

/**
 * Rewrites the local dataset under shop-prefixed ids for a fresh shop's seed.
 * Object references that must keep pointing at the same entity are rewritten
 * together: order line items follow their product, stock logs follow their
 * product, and recurring orders follow their parent template. Display names
 * (`deliveredBy`, `productName`, …) are left alone — they are text, not ids.
 */
function prefixSeedData(
  data: {
    orders: Order[];
    customers: Customer[];
    products: Product[];
    condos: CondoLocation[];
    stockLogs: StockLog[];
    staffUsers?: StaffUser[];
  },
  prefix: (id: string) => string
) {
  return {
    orders: data.orders.map((o) => ({
      ...o,
      id: prefix(o.id),
      items: o.items.map((it) => ({ ...it, productId: prefix(it.productId) })),
      recurringParentOrderId: o.recurringParentOrderId
        ? prefix(o.recurringParentOrderId)
        : undefined,
    })),
    customers: data.customers.map((c) => ({ ...c, id: prefix(c.id) })),
    products: data.products.map((p) => ({ ...p, id: prefix(p.id) })),
    condos: data.condos.map((c) => ({ ...c, id: prefix(c.id) })),
    stockLogs: data.stockLogs.map((l) => ({
      ...l,
      id: prefix(l.id),
      productId: prefix(l.productId),
    })),
    staffUsers: data.staffUsers?.map((u) => ({ ...u, id: prefix(u.id) })),
  };
}

// ----------------- P2 backfill: stamp shopId on legacy data -----------------

/** The seven collections that receive a `shopId` during the P2 backfill. */
export const BACKFILL_COLLECTIONS: CloudCollection[] = [
  'orders',
  'customers',
  'products',
  'condos',
  'stockLogs',
  'users',
  'settings',
];

export interface BackfillResult {
  collection: CloudCollection;
  /** Documents examined. */
  scanned: number;
  /** Documents that were missing a shopId and received one. */
  updated: number;
  /** Set when this collection failed; the other collections still run. */
  error?: string;
}

/**
 * P2 migration: stamp `shopId` onto the pre-tenancy dataset.
 *
 * Runs from the owner's browser — the whole project is designed around having
 * no service account and no server credentials, so data migration has to be
 * something the owner's client can do (docs/MULTI-TENANT-SPEC.md §9).
 *
 * Guarantees:
 * - **idempotent**: a document that already carries a `shopId` is never
 *   touched — running twice reports `updated: 0` the second time;
 * - **no cross-shop reassignment**: an existing `shopId` is authority, even a
 *   different one; this function only adopts documents that are still
 *   un-owned (the P4 rules allow adoption solely for the bootstrap
 *   super-admin — see the pinned test "super-admin adopts legacy path into
 *   shop A (P2 backfill)");
 * - **failure isolation**: a denied or malformed collection reports its error
 *   and the remaining collections still run, because a half-stamped dataset
 *   is recoverable (re-run) while an aborted one looks like a finished job;
 * - **safe to re-run**: the caller should re-run until every result reports
 *   `error: undefined`.
 *
 * @param shopId the shop the legacy dataset belongs to (the owner's own shop).
 * @throws when `shopId` is empty — stamping documents into the void would
 *         make them unreadable under the P4 rules with no way to tell which
 *         shop they were meant for.
 *
 * NOTE: this lists each collection WITHOUT a `shopId` filter, which is exactly
 * what the P4 rules deny by design — so it is a pre-cutover tool. The rollout
 * order in spec §9 (backfill at P1/P3, rules at P4) is not advisory: after P4,
 * un-stamped legacy documents are unreadable by everyone, including the owner.
 */
export async function backfillShopId(shopId: string): Promise<BackfillResult[]> {
  if (!shopId || shopId.trim() === '') {
    throw new Error('backfillShopId: a non-empty shopId is required');
  }

  const results: BackfillResult[] = [];

  for (const name of BACKFILL_COLLECTIONS) {
    const result: BackfillResult = { collection: name, scanned: 0, updated: 0 };
    results.push(result);

    try {
      const snap = await getDocs(collection(db, name));
      for (const docSnap of snap.docs) {
        result.scanned += 1;
        const data = docSnap.data();
        const existing = data?.shopId;
        if (typeof existing === 'string' && existing.length > 0) continue; // already owned
        await updateDoc(docSnap.ref, { shopId });
        result.updated += 1;
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      console.warn(`Backfill of "${name}" failed (re-run to retry):`, err);
    }
  }

  return results;
}

// ----------------- Role revocation / live role listener -----------------

/**
 * Subscribes to the live role document for a user. If the document is deleted
 * (role revoked) or changes, the callback is notified. Used to immediately sign
 * the user out when access is revoked, rather than waiting for the next write.
 */
export function subscribeToStaffRole(
  uid: string,
  onRoleChange: (role: StaffRoleDoc | null) => void,
  onError?: (error: unknown) => void
): () => void {
  try {
    const ref = doc(db, 'staffRoles', uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          onRoleChange(null);
          return;
        }
        onRoleChange(snap.data() as StaffRoleDoc);
      },
      (err) => {
        if (onError) {
          onError(err);
          return;
        }
        handleFirestoreError(err, OperationType.GET, `staffRoles/${uid}`);
      }
    );
  } catch (err) {
    if (onError) {
      onError(err);
    }
    handleFirestoreError(err as Error, OperationType.GET, `staffRoles/${uid}`);
    return () => {};
  }
}

// ===========================================================================
// P3 — multi-tenant shop layer (docs/MULTI-TENANT-SPEC.md §5, §7)
//
// Self-serve onboarding: every visitor can create their OWN shop or join an
// existing one with an invite code. These functions are thin wrappers over
// the four tenancy collections (`accounts`, `shops`, `shops/{sid}/members`,
// `inviteCodes`) — every authorization decision lives in firestore.rules;
// here we only keep the WRITE ORDER rules-safe (see createShop) and surface
// user-facing Vietnamese errors instead of raw Firestore blobs.
// ===========================================================================

/** An error whose message is already written for the end user (Vietnamese). */
class UserFacingError extends Error {
  readonly userFacing = true;
}
const userError = (message: string) => new UserFacingError(message);

/** Re-throw user-facing errors untouched; wrap technical ones with context. */
function toUserFacing(error: unknown, what: string): Error {
  if (error instanceof UserFacingError) return error;
  console.error(`[tenancy] ${what}:`, error);
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') {
    return userError(`Không ${what}: quyền bị từ chối — rules mới có thể chưa được triển khai.`);
  }
  return userError(`Không ${what}. Kiểm tra kết nối mạng rồi thử lại.`);
}

export interface ShopDoc {
  shopId: string;
  name: string;
  ownerUid: string;
  ownerEmail: string;
  /** Bearer code others type to request a join — readable by admins. */
  inviteCode: string;
  status: 'active' | 'archived';
  createdAt: string;
}

export interface AccountDoc {
  uid: string;
  email: string;
  displayName: string;
  /** ACTIVE memberships (navigation only — never trusted for authz). */
  shops: string[];
  defaultShopId: string;
  /** Shops asked for and still awaiting approval (cleared on decision). */
  pendingShops?: string[];
}

export interface ShopMemberDoc {
  uid: string;
  shopId: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'pending' | 'revoked';
  /** Required by the rules for a pending join — the invite that authorised it. */
  inviteCode?: string;
  createdAt: string;
}

export interface InviteDoc {
  code: string;
  shopId: string;
  createdBy: string;
  createdAt: string;
}

/**
 * Which rules generation is live. The `accounts/{uid}` path does not exist
 * before P4, so a permission-denied on that get is the deterministic signal
 * that the app is still running against the single-tenant rules — no feature
 * flag, no config: the data layer itself answers "is tenancy ready?".
 *   - `legacy` → behave exactly like the Phase 1 app (staffRoles flow);
 *   - `tenancy` → onboarding/shop flow (account may be null = no shop yet).
 * Non-permission errors (offline, etc.) propagate: the caller stays local
 * and retries on the next sign-in instead of mis-classifying the backend.
 */
export type TenancyProbe =
  | { mode: 'legacy' }
  | { mode: 'tenancy'; account: AccountDoc | null };

export async function probeAccount(uid: string): Promise<TenancyProbe> {
  try {
    const snap = await getDoc(doc(db, 'accounts', uid));
    return { mode: 'tenancy', account: snap.exists() ? (snap.data() as AccountDoc) : null };
  } catch (error) {
    if ((error as { code?: string } | null)?.code === 'permission-denied') {
      return { mode: 'legacy' };
    }
    throw error;
  }
}

const SHOP_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity

function randomFrom(alphabet: string, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** `shp_` + 12 chars — satisfies the rules' `validShopId` pattern and ≤64. */
export function generateShopId(): string {
  return `shp_${randomFrom(SHOP_ID_ALPHABET, 12)}`;
}

/** 8 chars, A–Z0–9 only — satisfies `^[A-Z0-9]+$`, 6–32 chars (rules). */
export function generateInviteCode(): string {
  return randomFrom(INVITE_ALPHABET, 8);
}

export async function getAccount(uid: string): Promise<AccountDoc | null> {
  try {
    const snap = await getDoc(doc(db, 'accounts', uid));
    return snap.exists() ? (snap.data() as AccountDoc) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `accounts/${uid}`);
    return null;
  }
}

/**
 * Record navigation state in the caller's own index (`shops` may only grow —
 * the rules reject a shrink, which is what enforces 1-shop-per-account).
 * `pending` entries come and go freely; they grant nothing by themselves.
 */
export async function updateAccountIndex(
  uid: string,
  patch: { shops?: string[]; defaultShopId?: string; pendingShops?: string[] }
): Promise<void> {
  try {
    await setDoc(doc(db, 'accounts', uid), patch, { merge: true });
  } catch (error) {
    throw toUserFacing(error, 'cập nhật danh sách cửa hàng');
  }
}

export interface CreateShopParams {
  ownerUid: string;
  ownerEmail: string;
  ownerDisplayName: string;
  name: string;
}

export interface CreateShopResult {
  shopId: string;
  inviteCode: string;
}

/**
 * Create the caller's own shop and seat them as its active ADMIN.
 *
 * WRITE ORDER IS LOAD-BEARING (the rules read it at every step):
 *   1. `accounts/{uid}` exists with `shops: []`   — the 1-shop guard reads it;
 *   2. `shops/{sid}` (guard proves `shops.size() == 0`);
 *   3. `members/{sid}/{uid}` ADMIN active          — owner seat, same batch;
 *   4. `inviteCodes/{code}`                        — needs admin membership;
 *   5. `accounts.shops → [sid]`                    — GROWN LAST.
 * If any write fails before (5), the account still says "no shop", so the
 * user simply retries: the guard passes again and a fresh shop is created
 * (any orphaned shop doc from a half-finished attempt has no members and is
 * invisible to everyone). Growing the index first would strand the account
 * pointing at a shop it can never read.
 */
export async function createShop(params: CreateShopParams): Promise<CreateShopResult> {
  const { ownerUid, ownerEmail, ownerDisplayName } = params;
  const name = (params.name ?? '').trim() || 'Cửa hàng của tôi';
  if (!ownerUid) {
    throw userError('Bạn cần đăng nhập Google trước khi tạo cửa hàng.');
  }

  // 1. Navigation index first (create-or-validate).
  const accRef = doc(db, 'accounts', ownerUid);
  try {
    const snap = await getDoc(accRef);
    if (snap.exists()) {
      const existing = snap.data() as AccountDoc;
      if ((existing.shops?.length ?? 0) > 0) {
        throw userError('Mỗi tài khoản chỉ có 1 cửa hàng. Hãy dùng mã mời để tham gia cửa hàng khác.');
      }
    } else {
      await setDoc(accRef, {
        uid: ownerUid,
        email: ownerEmail,
        displayName: ownerDisplayName,
        shops: [],
        defaultShopId: '',
        pendingShops: [],
      });
    }
  } catch (error) {
    throw toUserFacing(error, 'chuẩn bị tài khoản cửa hàng');
  }

  // 2–5. Reserve an unused invite code, then create everything.
  const shopId = generateShopId();
  const now = new Date().toISOString();
  let inviteCode = generateInviteCode();
  try {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const taken = await getDoc(doc(db, 'inviteCodes', inviteCode));
      if (!taken.exists()) break;
      if (attempt === 5) {
        throw userError('Không tạo được mã mời duy nhất. Bấm tạo lại.');
      }
      inviteCode = generateInviteCode();
    }
    await setDoc(doc(db, 'shops', shopId), {
      shopId,
      name,
      ownerUid,
      ownerEmail,
      inviteCode,
      status: 'active',
      createdAt: now,
    });
    await setDoc(doc(db, 'shops', shopId, 'members', ownerUid), {
      uid: ownerUid,
      shopId,
      email: ownerEmail,
      displayName: ownerDisplayName,
      role: 'ADMIN',
      status: 'active',
      createdAt: now,
    });
    await setDoc(doc(db, 'inviteCodes', inviteCode), {
      code: inviteCode,
      shopId,
      createdBy: ownerUid,
      createdAt: now,
    });
    // 5. LAST: grow the index (see order note above).
    await setDoc(accRef, { shops: [shopId], defaultShopId: shopId, pendingShops: [] }, { merge: true });
  } catch (error) {
    throw toUserFacing(error, 'tạo cửa hàng');
  }

  return { shopId, inviteCode };
}

export interface JoinShopParams {
  uid: string;
  email: string;
  displayName: string;
  inviteCode: string;
}

/**
 * Request membership in the shop an invite code points at. The member doc is
 * created PENDING — only a shop admin can flip it to active (rules). The
 * caller's account index is written first as `pendingShops` (never `shops`),
 * so a rejected join never grants navigation to a shop they cannot read.
 * An already-active member just gets their index healed (self-service repair
 * for a migration whose index write was lost).
 */
export async function joinShop(params: JoinShopParams): Promise<{ shopId: string }> {
  const { uid, email, displayName } = params;
  const code = (params.inviteCode ?? '').trim().toUpperCase();
  if (code.length < 6 || code.length > 32) {
    throw userError('Mã mời gồm 6–32 ký tự (chữ hoa, số). Kiểm tra lại mã.');
  }
  if (!uid) {
    throw userError('Bạn cần đăng nhập Google trước khi tham gia cửa hàng.');
  }

  // 1. Resolve the bearer code → shop. Reading an invite is allowed for any
  //    verified user; it grants nothing until the member doc exists.
  let shopId: string;
  try {
    const snap = await getDoc(doc(db, 'inviteCodes', code));
    if (!snap.exists()) {
      throw userError('Mã mời không đúng hoặc đã bị thu hồi.');
    }
    shopId = (snap.data() as InviteDoc).shopId;
  } catch (error) {
    throw toUserFacing(error, 'kiểm tra mã mời');
  }

  const accRef = doc(db, 'accounts', uid);
  const memberRef = doc(db, 'shops', shopId, 'members', uid);
  const now = new Date().toISOString();

  // 2. Read current membership (self-read is always allowed).
  let member: ShopMemberDoc | null = null;
  try {
    const snap = await getDoc(memberRef);
    member = snap.exists() ? (snap.data() as ShopMemberDoc) : null;
  } catch (error) {
    throw toUserFacing(error, 'kiểm tra trạng thái tham gia');
  }

  const targetPending = member ? (member.status === 'pending' ? [shopId] : []) : [shopId];

  // 3. Index first: created/merged as `pendingShops` (or healed into `shops`
  //    when the membership is already active).
  try {
    const snap = await getDoc(accRef);
    if (!snap.exists()) {
      await setDoc(accRef, {
        uid,
        email,
        displayName,
        shops: member?.status === 'active' ? [shopId] : [],
        defaultShopId: member?.status === 'active' ? shopId : '',
        pendingShops: targetPending,
      });
    } else {
      const acc = snap.data() as AccountDoc;
      const isActive = member?.status === 'active';
      const pending = isActive
        ? (acc.pendingShops ?? []).filter((s) => s !== shopId)
        : [...new Set([...(acc.pendingShops ?? []), shopId])].filter(
            (s) => !(acc.shops ?? []).includes(s)
          );
      const patch: { shops?: string[]; defaultShopId?: string; pendingShops?: string[] } = {
        pendingShops: pending,
      };
      if (isActive && !(acc.shops ?? []).includes(shopId)) {
        // Grow is allowed once — this is the approval-heal path.
        patch.shops = [...(acc.shops ?? []), shopId];
        patch.defaultShopId = acc.defaultShopId || shopId;
      }
      await setDoc(accRef, patch, { merge: true });
    }
  } catch (error) {
    throw toUserFacing(error, 'cập nhật danh sách cửa hàng');
  }

  // 4. Member doc — create only when there is none to update (an update by a
  //    non-admin would be denied by the rules anyway).
  if (!member) {
    try {
      await setDoc(memberRef, {
        uid,
        shopId,
        email,
        displayName,
        role: 'CASHIER', // default request; the admin picks the real role on approval
        status: 'pending',
        inviteCode: code,
        createdAt: now,
      });
    } catch (error) {
      throw toUserFacing(error, 'gửi yêu cầu tham gia');
    }
  } else if (member.status === 'revoked') {
    throw userError('Bạn đã bị thu hồi quyền trong cửa hàng này. Liên hệ chủ cửa hàng.');
  }

  return { shopId };
}

export async function getShop(shopId: string): Promise<ShopDoc | null> {
  try {
    const snap = await getDoc(doc(db, 'shops', shopId));
    return snap.exists() ? (snap.data() as ShopDoc) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `shops/${shopId}`);
    return null;
  }
}

/** The shops an account's index points at (1 by product rule; ≤10 by rules). */
export async function listMyShops(account: AccountDoc): Promise<ShopDoc[]> {
  const shops: ShopDoc[] = [];
  for (const shopId of account.shops ?? []) {
    try {
      const shop = await getShop(shopId);
      if (shop) shops.push(shop);
    } catch (error) {
      console.warn(`listMyShops: cannot read shop ${shopId}:`, error);
    }
  }
  return shops;
}

export async function getShopMember(
  shopId: string,
  uid: string
): Promise<ShopMemberDoc | null> {
  try {
    const snap = await getDoc(doc(db, 'shops', shopId, 'members', uid));
    return snap.exists() ? (snap.data() as ShopMemberDoc) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `shops/${shopId}/members/${uid}`);
    return null;
  }
}

/** Active + pending members of a shop. Any member may read the roster. */
export async function listShopMembers(shopId: string): Promise<ShopMemberDoc[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'members'));
    return snap.docs.map((d) => d.data() as ShopMemberDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `shops/${shopId}/members`);
    return [];
  }
}

/** Members awaiting approval (status == 'pending'). */
export async function listShopRequests(shopId: string): Promise<ShopMemberDoc[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'shops', shopId, 'members'), where('status', '==', 'pending'))
    );
    return snap.docs.map((d) => d.data() as ShopMemberDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `shops/${shopId}/members?pending`);
    return [];
  }
}

/** Change a member's role. Shop admin only (enforced by the rules). */
export async function setMemberRole(shopId: string, uid: string, role: UserRole): Promise<void> {
  try {
    await updateDoc(doc(db, 'shops', shopId, 'members', uid), { role });
  } catch (error) {
    throw toUserFacing(error, 'đổi vai trò thành viên');
  }
}

/** Approve a pending join (optionally picking the role at the same time). */
export async function approveMember(
  shopId: string,
  uid: string,
  role: UserRole
): Promise<void> {
  try {
    await updateDoc(doc(db, 'shops', shopId, 'members', uid), { status: 'active', role });
  } catch (error) {
    throw toUserFacing(error, 'duyệt thành viên');
  }
}

/**
 * Remove a member (reject a pending join, or revoke an active role). The
 * document is DELETED rather than set to `revoked`: the member's client sees
 * the doc disappear and signs out immediately, and the user stays free to
 * re-request a join later (self-delete + fresh pending create both work).
 */
export async function removeMember(shopId: string, uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'members', uid));
  } catch (error) {
    throw toUserFacing(error, 'gỡ thành viên');
  }
}

/**
 * Watch one's own membership: fires on approval, role change, rejection and
 * revocation (doc deleted → callback gets null). This is the tenancy-mode
 * replacement for `subscribeToStaffRole`.
 */
export function subscribeToMembership(
  shopId: string,
  uid: string,
  onMemberChange: (member: ShopMemberDoc | null) => void,
  onError?: (error: unknown) => void
): () => void {
  try {
    return onSnapshot(
      doc(db, 'shops', shopId, 'members', uid),
      (snap) => onMemberChange(snap.exists() ? (snap.data() as ShopMemberDoc) : null),
      (err) => {
        if (onError) {
          onError(err);
          return;
        }
        console.warn(`subscribeToMembership(${shopId}/${uid}) error:`, err);
      }
    );
  } catch (err) {
    if (onError) onError(err);
    else console.warn(`subscribeToMembership(${shopId}/${uid}) setup failed:`, err);
    return () => {};
  }
}

// ----------------------------------------------------- adoption + migration

export type AdoptableCollection = Exclude<CloudCollection, 'settings'>;

export interface AdoptCollectionResult {
  collection: AdoptableCollection;
  /** Documents we tried to stamp. */
  attempted: number;
  /** Stamped with `shopId` — a legacy doc that now belongs to this shop. */
  adopted: number;
  /** No document at that path (fresh shop — nothing to adopt). */
  missing: number;
  /** Denied (not the bootstrap super-admin) or failed for another reason. */
  denied: number;
}

/**
 * P3 adoption: stamp `shopId` onto the pre-tenancy documents the LOCAL STATE
 * already knows by id.
 *
 * Why by path and not by listing: after the P4 rules go live, an unfiltered
 * `list` is denied by design (fail-closed), so a post-cutover migration can
 * no longer enumerate legacy collections — but the owner's browser already
 * holds every id in memory, and `updateDoc` at a concrete path is provable.
 * The rules' adoption clause allows this ONLY for the bootstrap super-admin,
 * so for any other account every attempt reports `denied` and the caller
 * falls through to the prefixed-seed path (that is by design, not an error).
 *
 * Idempotent: an already-stamped doc is simply re-stamped with the same
 * value (allowed for the owner) or denied (anyone else).
 *
 * Known limitation (documented in spec §9): cloud-only documents that exist
 * on NO local device cannot be discovered post-cutover. The rollout runs
 * adoption from the owner's device while their local state is the complete
 * legacy dataset, so this does not bite in the shipped flow.
 */
export async function adoptLocalDocumentsIntoShop(
  shopId: string,
  ids: Partial<Record<AdoptableCollection, string[]>>
): Promise<{ adopted: number; results: AdoptCollectionResult[] }> {
  if (!shopId || shopId.trim() === '') {
    throw new Error('adoptLocalDocumentsIntoShop: a non-empty shopId is required');
  }
  const collections: AdoptableCollection[] = ['orders', 'customers', 'products', 'condos', 'stockLogs', 'users'];
  const results: AdoptCollectionResult[] = [];
  let adopted = 0;

  for (const name of collections) {
    const list = ids[name] ?? [];
    const result: AdoptCollectionResult = { collection: name, attempted: 0, adopted: 0, missing: 0, denied: 0 };
    results.push(result);

    for (const docId of list) {
      if (!docId) continue;
      result.attempted += 1;
      try {
        await updateDoc(doc(db, name, docId), { shopId });
        result.adopted += 1;
        adopted += 1;
      } catch (error) {
        const code = (error as { code?: string } | null)?.code;
        if (code === 'not-found') {
          result.missing += 1;
        } else {
          result.denied += 1;
          if (code !== 'permission-denied') {
            console.warn(`adopt ${name}/${docId}:`, error);
          }
        }
      }
    }
  }

  return { adopted, results };
}

export interface StaffMigrationResult {
  /** Legacy `staffRoles` converted into active members of the shop. */
  migrated: number;
  /** `accounts/{uid}` indexes created or healed for those staff. */
  provisioned: number;
  /** Staff left completely untouched (seat AND index already in place). */
  skipped: number;
  /** Per-staff failure (e.g. provisioning denied for a non-super-admin). */
  failed: number;
}

/**
 * P3 migration: copy every legacy `staffRoles/{uid}` assignment into
 * `shops/{sid}/members/{uid}` (status active, same role) and make sure each
 * migrated user has a navigation index pointing at the shop.
 *
 * Runs on the owner's device right after `createShop` — best effort:
 * - a non-admin caller cannot even LIST `staffRoles`, which returns an empty
 *   result and turns this into a no-op (fresh shops have nothing to migrate);
 * - `staffRoles` documents are NOT deleted here: they stay until P5 as the
 *   rollback path and are inert under the new rules (they grant legacy-branch
 *   reads of un-namespaced docs only);
 * - provisioning `accounts/{uid}` for ANOTHER uid is allowed solely for the
 *   bootstrap super-admin — for anyone else those attempts count as `failed`
 *   and the affected staff joins through the normal invite flow instead.
 */
export async function migrateLegacyStaffRolesToMembers(
  shopId: string
): Promise<StaffMigrationResult> {
  const out: StaffMigrationResult = { migrated: 0, provisioned: 0, skipped: 0, failed: 0 };
  if (!shopId) return out;

  let roles: StaffRoleDoc[] = [];
  try {
    roles = await listStaffRoles();
  } catch (error) {
    console.info('migrate: staffRoles not readable (no admin role?) — nothing to migrate.', error);
    return out;
  }

  const now = new Date().toISOString();
  for (const r of roles) {
    try {
      let changed = false;

      // a) member seat (create only — never clobber an existing seat)
      const memberRef = doc(db, 'shops', shopId, 'members', r.uid);
      const memberSnap = await getDoc(memberRef);
      if (!memberSnap.exists()) {
        await setDoc(memberRef, {
          uid: r.uid,
          shopId,
          email: r.email,
          displayName: r.displayName,
          role: r.role,
          status: 'active',
          createdAt: now,
        });
        out.migrated += 1;
        changed = true;
      }

      // b) navigation index — self writes are always fine; other uids need
      //    the super-admin carve-out in the accounts rules.
      const accRef = doc(db, 'accounts', r.uid);
      const accSnap = await getDoc(accRef);
      if (!accSnap.exists()) {
        await setDoc(accRef, {
          uid: r.uid,
          email: r.email,
          displayName: r.displayName,
          shops: [shopId],
          defaultShopId: shopId,
          pendingShops: [],
        });
        out.provisioned += 1;
        changed = true;
      } else {
        const acc = accSnap.data() as AccountDoc;
        if ((acc.shops ?? []).length === 0) {
          await setDoc(
            accRef,
            {
              shops: [shopId],
              defaultShopId: acc.defaultShopId || shopId,
              pendingShops: (acc.pendingShops ?? []).filter((s) => s !== shopId),
            },
            { merge: true }
          );
          out.provisioned += 1;
          changed = true;
        }
      }

      if (!changed) out.skipped += 1;
    } catch (error) {
      out.failed += 1;
      console.warn(`migrate: could not convert staffRoles/${r.uid}:`, error);
    }
  }

  return out;
}
