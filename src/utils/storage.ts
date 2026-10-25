import { type Product, type Customer, type CondoLocation, type Order, type StockLog, type StaffUser } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Cà phê Muối (Salt Coffee)',
    price: 35000,
    cost: 16000,
    initialStock: 50,
    stockReceived: 10,
    quantitySold: 3, // ORD-1001 (2) + ORD-1003 (1)
    currentStock: 57, // 50 + 10 - 3
    unit: 'Ly',
  },
  {
    id: 'prod-2',
    name: 'Trà Đào Cam Sả (Peach Tea)',
    price: 40000,
    cost: 18000,
    initialStock: 40,
    stockReceived: 0,
    quantitySold: 2, // ORD-1002 (2)
    currentStock: 38, // 40 - 2
    unit: 'Ly',
  },
  {
    id: 'prod-3',
    name: 'Bánh mì Chảo Đặc Biệt (Combo Bread)',
    price: 65000,
    cost: 30000,
    initialStock: 30,
    stockReceived: 15,
    quantitySold: 3, // ORD-1001 (1) + ORD-1004 (2)
    currentStock: 42, // 30 + 15 - 3
    unit: 'Phần',
  },
  {
    id: 'prod-4',
    name: 'Sữa chua Trân châu (Pearl Yogurt)',
    price: 30000,
    cost: 12000,
    initialStock: 25,
    stockReceived: 5,
    quantitySold: 2, // ORD-1003 (2)
    currentStock: 28, // 25 + 5 - 2
    unit: 'Hộp',
  },
];

export const INITIAL_CONDOS: CondoLocation[] = [
  {
    id: 'condo-1',
    name: 'Chung cư Sunrise City',
    blocks: ['A', 'B', 'C', 'D'],
  },
  {
    id: 'condo-2',
    name: 'Vinhomes Grand Park',
    blocks: ['S1', 'S2', 'S3', 'S5', 'S6'],
  },
  {
    id: 'condo-3',
    name: 'Masteri Centre Point',
    blocks: ['A', 'B', 'C', 'D'],
  },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Anh Tuấn',
    phone: '0901234567',
    defaultLocationType: 'condo',
    condoName: 'Chung cư Sunrise City',
    block: 'B',
    floor: '20',
    unit: '10',
    deliveryNote: 'Bấm chuông để cửa',
  },
  {
    id: 'cust-2',
    name: 'Chị Mai',
    phone: '0912345678',
    defaultLocationType: 'condo',
    condoName: 'Chung cư Sunrise City',
    block: 'B',
    floor: '15',
    unit: '01',
    deliveryNote: 'Treo trước cửa giúp em',
  },
  {
    id: 'cust-3',
    name: 'Anh Dũng',
    phone: '0987654321',
    defaultLocationType: 'condo',
    condoName: 'Chung cư Sunrise City',
    block: 'B',
    floor: '12',
    unit: '05',
    deliveryNote: 'Nhà có em bé ngủ, không bấm chuông',
  },
  {
    id: 'cust-4',
    name: 'Chị Lan (Khách ngoài)',
    phone: '0933445566',
    defaultLocationType: 'external',
    externalAddress: '72 Lê Lợi, P. Bến Nghé, Quận 1 (Tòa nhà AB)',
    deliveryNote: 'Giao sảnh bảo vệ, gọi trước 5 phút',
  },
];

const now = new Date();
const formatTodayTime = (hoursAgo: number, minutesAgo: number) => {
  const d = new Date(now.getTime() - (hoursAgo * 60 + minutesAgo) * 60000);
  return d.toISOString();
};

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ORD-1001',
    createdAt: formatTodayTime(2, 15),
    customerName: 'Anh Tuấn',
    customerPhone: '0901234567',
    items: [
      {
        productId: 'prod-1',
        productName: 'Cà phê Muối (Salt Coffee)',
        quantity: 2,
        unitPrice: 35000,
        lineTotal: 70000,
        unit: 'Ly',
        cost: 16000,
        price: 35000,
      },
      {
        productId: 'prod-3',
        productName: 'Bánh mì Chảo Đặc Biệt (Combo Bread)',
        quantity: 1,
        unitPrice: 65000,
        lineTotal: 65000,
        unit: 'Phần',
        cost: 30000,
        price: 65000,
      },
    ],
    totalAmount: 135000,
    cost: 62000,
    price: 135000,
    location: {
      type: 'condo',
      condoName: 'Chung cư Sunrise City',
      block: 'B',
      floor: '20',
      unit: '10',
      formattedAddress: 'B-20-10',
      deliveryNote: 'Gate code 1234 • Bấm chuông để trước cửa',
    },
    deliveryStatus: 'PENDING',
    scheduledDeliveryTime: new Date(Date.now() + 50 * 60000).toISOString(),
    scheduledReminderSent: false,
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
    paymentTime: formatTodayTime(2, 10),
    paidAmount: 135000,
    paidConfirmedBy: 'Thu ngân Minh',
    status: 'ACTIVE',
    deliveryNote: 'Gate code 1234 • Bấm chuông để trước cửa',
    internalNote: 'Khách VIP, thường xuyên đặt ăn trưa',
    note: 'Gate code 1234 • Bấm chuông để trước cửa',
    tags: ['Urgent', 'VIP'],
    priority: 'HIGH',
  },
  {
    id: 'ORD-1002',
    createdAt: formatTodayTime(1, 45),
    customerName: 'Chị Mai',
    customerPhone: '0912345678',
    items: [
      {
        productId: 'prod-2',
        productName: 'Trà Đào Cam Sả (Peach Tea)',
        quantity: 2,
        unitPrice: 40000,
        lineTotal: 80000,
        unit: 'Ly',
        cost: 18000,
        price: 40000,
      },
    ],
    totalAmount: 80000,
    cost: 36000,
    price: 80000,
    location: {
      type: 'condo',
      condoName: 'Chung cư Sunrise City',
      block: 'B',
      floor: '15',
      unit: '01',
      formattedAddress: 'B-15-01',
      deliveryNote: 'Leave at front desk (Gửi sảnh lễ tân)',
    },
    deliveryStatus: 'PENDING',
    paymentStatus: 'UNPAID',
    status: 'ACTIVE',
    deliveryNote: 'Leave at front desk (Gửi sảnh lễ tân)',
    internalNote: 'Khách dặn làm ít ngọt',
    note: 'Leave at front desk (Gửi sảnh lễ tân)',
    tags: ['Subscription', 'Định kỳ'],
    priority: 'MEDIUM',
    isRecurring: true,
    recurringFrequency: 'WEEKLY',
    nextRecurringDate: new Date().toISOString().slice(0, 10),
    recurringActive: true,
  },
  {
    id: 'ORD-1003',
    createdAt: formatTodayTime(1, 10),
    customerName: 'Anh Dũng',
    customerPhone: '0987654321',
    items: [
      {
        productId: 'prod-4',
        productName: 'Sữa chua Trân châu (Pearl Yogurt)',
        quantity: 2,
        unitPrice: 30000,
        lineTotal: 60000,
        unit: 'Hộp',
        cost: 12000,
        price: 30000,
      },
      {
        productId: 'prod-1',
        productName: 'Cà phê Muối (Salt Coffee)',
        quantity: 1,
        unitPrice: 35000,
        lineTotal: 35000,
        unit: 'Ly',
        cost: 16000,
        price: 35000,
      },
    ],
    totalAmount: 95000,
    cost: 40000,
    price: 95000,
    location: {
      type: 'condo',
      condoName: 'Chung cư Sunrise City',
      block: 'B',
      floor: '12',
      unit: '05',
      formattedAddress: 'B-12-05',
      deliveryNote: 'Nhà có em bé ngủ, không bấm chuông',
    },
    deliveryStatus: 'PENDING',
    scheduledDeliveryTime: new Date(Date.now() + 25 * 60000).toISOString(),
    scheduledReminderSent: false,
    paymentStatus: 'PAID',
    paymentMethod: 'BANK_TRANSFER',
    paymentTime: formatTodayTime(1, 5),
    paidAmount: 95000,
    paidConfirmedBy: 'Chủ shop Hoa',
    status: 'ACTIVE',
    deliveryNote: 'Nhà có em bé ngủ, không bấm chuông',
    internalNote: 'Đã báo bếp làm nóng trước khi đóng gói',
    tags: ['Gift'],
    priority: 'HIGH',
  },
  {
    id: 'ORD-1004',
    createdAt: formatTodayTime(0, 30),
    customerName: 'Chị Lan (Khách ngoài)',
    customerPhone: '0933445566',
    items: [
      {
        productId: 'prod-3',
        productName: 'Bánh mì Chảo Đặc Biệt (Combo Bread)',
        quantity: 2,
        unitPrice: 65000,
        lineTotal: 130000,
        unit: 'Phần',
        cost: 30000,
        price: 65000,
      },
    ],
    totalAmount: 130000,
    cost: 60000,
    price: 130000,
    location: {
      type: 'external',
      externalAddress: '72 Lê Lợi, P. Bến Nghé, Quận 1 (Tòa nhà AB)',
      formattedAddress: '72 Lê Lợi, P. Bến Nghé, Q.1',
      deliveryNote: 'Giao sảnh bảo vệ, gọi trước 5 phút',
    },
    deliveryStatus: 'OUT_FOR_DELIVERY',
    outForDeliveryAt: formatTodayTime(0, 25),
    deliveryDueAt: formatTodayTime(0, 5),
    dueReminderSent: false,
    paymentStatus: 'UNPAID',
    status: 'ACTIVE',
    deliveryNote: 'Giao sảnh bảo vệ, gọi trước 5 phút',
    internalNote: 'Cần xuất hóa đơn công ty cuối tháng',
    note: 'Khách hẹn giao đúng 11h30',
    tags: [],
    priority: 'LOW',
  },
  {
    id: 'ORD-1005',
    createdAt: formatTodayTime(0, 15),
    customerName: 'Văn phòng TechCorp (Hằng tháng)',
    customerPhone: '0901239876',
    items: [
      {
        productId: 'prod-1',
        productName: 'Cà phê Muối (Salt Coffee)',
        quantity: 4,
        unitPrice: 35000,
        lineTotal: 140000,
        unit: 'Ly',
        cost: 16000,
        price: 35000,
      },
      {
        productId: 'prod-3',
        productName: 'Bánh mì Chảo Đặc Biệt (Combo Bread)',
        quantity: 2,
        unitPrice: 65000,
        lineTotal: 130000,
        unit: 'Phần',
        cost: 30000,
        price: 65000,
      },
    ],
    totalAmount: 270000,
    cost: 124000,
    price: 270000,
    location: {
      type: 'external',
      externalAddress: 'Tầng 8, Tháp Bitexco, Q.1',
      formattedAddress: 'Tháp Bitexco, Q.1 (Tầng 8)',
      deliveryNote: 'Gate code 1234 • Leave at front desk',
    },
    deliveryStatus: 'PENDING',
    paymentStatus: 'UNPAID',
    status: 'ACTIVE',
    deliveryNote: 'Gate code 1234 • Leave at front desk',
    internalNote: 'Đơn định kỳ ăn trưa & cà phê hằng tháng cho văn phòng',
    note: 'Gate code 1234 • Leave at front desk',
    tags: ['Subscription', 'Định kỳ', 'Công ty'],
    priority: 'MEDIUM',
    isRecurring: true,
    recurringFrequency: 'MONTHLY',
    nextRecurringDate: new Date().toISOString().slice(0, 10),
    recurringActive: true,
  },
];

export const INITIAL_STOCK_LOGS: StockLog[] = [
  {
    id: 'log-1',
    productId: 'prod-1',
    productName: 'Cà phê Muối (Salt Coffee)',
    quantityAdded: 10,
    date: formatTodayTime(8, 0),
    note: 'Nhập đợt sáng',
    addedBy: 'Chủ shop Hoa',
  },
  {
    id: 'log-2',
    productId: 'prod-3',
    productName: 'Bánh mì Chảo Đặc Biệt (Combo Bread)',
    quantityAdded: 15,
    date: formatTodayTime(8, 0),
    note: 'Bánh mì tươi mới ra lò',
    addedBy: 'Chủ shop Hoa',
  },
  {
    id: 'log-3',
    productId: 'prod-4',
    productName: 'Sữa chua Trân châu (Pearl Yogurt)',
    quantityAdded: 5,
    date: formatTodayTime(8, 0),
    note: 'Nhập bổ sung tủ mát',
    addedBy: 'Chủ shop Hoa',
  },
];

export const INITIAL_STAFF_USERS: StaffUser[] = [
  {
    id: 'staff-admin-1',
    name: 'Hoa (Chủ quán)',
    role: 'ADMIN',
    email: 'khafibo@gmail.com',
    phone: '0901234567',
    active: true,
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'staff-kitchen-1',
    name: 'Bếp Trưởng Tuấn',
    role: 'KITCHEN',
    phone: '0912345678',
    active: true,
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'staff-shipper-1',
    name: 'Minh (Shipper)',
    role: 'SHIPPER',
    phone: '0933221100',
    active: true,
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'staff-shipper-2',
    name: 'Tài (Giao hàng)',
    role: 'SHIPPER',
    phone: '0944556677',
    active: true,
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'staff-cashier-1',
    name: 'An (Thu ngân)',
    role: 'CASHIER',
    phone: '0955667788',
    active: true,
    createdAt: '2026-10-01T08:00:00.000Z',
  },
];

export const OPERATOR_USERS = [
  'Minh (Shipper)',
  'Hoa (Chủ quán)',
  'Tài (Giao hàng)',
  'An (Thu ngân)',
];

export const STORAGE_KEYS = {
  PRODUCTS: 'oder_checklist_products_v1',
  CONDOS: 'oder_checklist_condos_v1',
  CUSTOMERS: 'oder_checklist_customers_v1',
  ORDERS: 'oder_checklist_orders_v1',
  STOCK_LOGS: 'oder_checklist_stock_logs_v1',
  CURRENT_USER: 'oder_checklist_user_v1',
  STAFF_USERS: 'oder_checklist_staff_v1',
  ACTIVE_STAFF_ID: 'oder_checklist_active_staff_id_v1',
  BANK_CONFIG: 'oder_checklist_bank_config_v1',
  NOTIFICATIONS: 'oder_checklist_notifications_v1',
  SOUND_ENABLED: 'oder_checklist_sound_enabled_v1',
  SCHEDULER_CONFIG: 'oder_checklist_scheduler_config_v1',
};

// ---------------------------------------------------------------------------
// Storage namespace (T1 multi-tenancy, see docs/MULTI-TENANT-SPEC.md)
//
// Every shop keeps its own copy of the local cache. Without this, a device
// used by two shops would mix their orders in one flat key — or silently
// overwrite one shop's data with the other's.
//
// An empty namespace is the pre-tenancy behaviour: keys are byte-for-byte the
// old ones, so nothing changes until a shop is actually selected (P3).
// ---------------------------------------------------------------------------

let storageNamespace = '';

/** Select the shop whose local cache is in use. '' = pre-tenancy storage. */
export function setStorageNamespace(namespace: string): void {
  storageNamespace = namespace ?? '';
}

export function getStorageNamespace(): string {
  return storageNamespace;
}

/** Resolve a base storage key against the active namespace. */
export function scopedStorageKey(baseKey: string): string {
  return storageNamespace ? `${baseKey}@${storageNamespace}` : baseKey;
}

// Deliberately NOT in STORAGE_KEYS and NOT namespaced: this key SELECTS the
// namespace, so it must be readable before any namespace exists. It records
// which shop this device last used, so a reload boots straight into that
// shop's cache instead of the demo fallback (P3).
const DEVICE_SHOP_KEY = 'oder_checklist_device_shop_v1';

export function getStoredActiveShopId(): string | null {
  try {
    return localStorage.getItem(DEVICE_SHOP_KEY);
  } catch {
    return null;
  }
}

export function setStoredActiveShopId(shopId: string): void {
  try {
    localStorage.setItem(DEVICE_SHOP_KEY, shopId);
  } catch (e) {
    // Private mode / quota: boot simply falls back to the legacy keys.
    console.warn('Could not persist the active shop id:', e);
  }
}

export function loadFromStorage<T>(key: string, fallback: T): T {
  const scopedKey = scopedStorageKey(key);
  try {
    const item = localStorage.getItem(scopedKey);
    if (!item) return fallback;
    return JSON.parse(item) as T;
  } catch (e) {
    console.warn(`Failed to parse storage item "${scopedKey}":`, e);
    return fallback;
  }
}

/**
 * Raised when the browser refuses to persist a value — almost always
 * `QuotaExceededError` on a full localStorage (mobile Safari gives ~5 MB for the
 * whole origin, and POD photos and long order histories eat it fast).
 *
 * Previously the failure was swallowed by a console.error, so a save that never
 * happened looked identical to a successful one: the UI kept the change in React
 * state and the user only discovered the loss after a reload.
 */
export class StorageQuotaError extends Error {
  readonly key: string;
  readonly quotaExceeded: boolean;

  constructor(key: string, quotaExceeded: boolean, cause: unknown) {
    super(
      quotaExceeded
        ? `Bộ nhớ trình duyệt đã đầy, không lưu được "${key}". Dữ liệu vừa thay đổi sẽ mất khi tải lại trang.`
        : `Không lưu được "${key}" vào bộ nhớ trình duyệt.`
    );
    this.name = 'StorageQuotaError';
    this.key = key;
    this.quotaExceeded = quotaExceeded;
    this.cause = cause;
  }
}

const isQuotaExceeded = (e: unknown): boolean =>
  e instanceof DOMException &&
  // Firefox and Chrome/Safari disagree on which code they report.
  (e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014);

/**
 * Persist a value to localStorage.
 *
 * Throws `StorageQuotaError` instead of failing silently — callers that care
 * about durability should catch it and tell the user.
 */
export function saveToStorage<T>(key: string, value: T): void {
  const scopedKey = scopedStorageKey(key);
  try {
    localStorage.setItem(scopedKey, JSON.stringify(value));
  } catch (e) {
    const quota = isQuotaExceeded(e);
    console.error(`Failed to save to storage "${scopedKey}":`, e);
    throw new StorageQuotaError(scopedKey, quota, e);
  }
}

/**
 * Best-effort variant of `saveToStorage` for callers that cannot surface an
 * error to the user (background sync effects, non-critical UI preferences).
 *
 * Returns the failure instead of throwing, so an effect that saves one slice of
 * state can never abort the effects saving the others.
 */
export function trySaveToStorage<T>(key: string, value: T): StorageQuotaError | null {
  try {
    saveToStorage(key, value);
    return null;
  } catch (e) {
    return e instanceof StorageQuotaError ? e : new StorageQuotaError(key, false, e);
  }
}

/** Delete the active-namespace entry for a base key. */
export function removeFromStorage(baseKey: string): void {
  try {
    localStorage.removeItem(scopedStorageKey(baseKey));
  } catch (e) {
    // A remove that throws is not a data-loss risk — nothing was written.
    console.warn(`Failed to remove storage item "${scopedStorageKey(baseKey)}":`, e);
  }
}

/**
 * Move the pre-tenancy cache (written before any shop existed) into a shop's
 * namespace. The data must survive the move — nothing is lost on migration —
 * and must not end up stored twice: localStorage is ~5 MB per origin and
 * orders carry delivery photos, so a duplicated key set can itself cause the
 * quota failure this migration is supposed to avoid.
 *
 * Contract:
 * - copy the legacy key into its namespaced slot, then delete the legacy key;
 * - if the namespaced slot is already populated, leave BOTH untouched (the
 *   shop's own data wins; the legacy copy stays as a rollback artefact);
 * - idempotent: a second run finds no legacy keys and returns an empty list;
 * - a failed copy (quota) keeps the legacy key: a move that cannot complete
 *   degrades into "no migration", never into data loss.
 *
 * @returns the base keys that were actually migrated.
 */
export function migrateLegacyStorageTo(namespace: string): string[] {
  if (!namespace) return [];
  const migrated: string[] = [];

  for (const baseKey of Object.values(STORAGE_KEYS)) {
    const legacyKey = baseKey;
    const scopedKey = `${baseKey}@${namespace}`;

    let raw: string | null;
    try {
      raw = localStorage.getItem(legacyKey);
    } catch (e) {
      console.warn(`Failed to read storage item "${legacyKey}" during migration:`, e);
      continue;
    }
    if (raw === null) continue;
    if (localStorage.getItem(scopedKey) !== null) continue; // shop data wins

    try {
      localStorage.setItem(scopedKey, raw);
      localStorage.removeItem(legacyKey);
      migrated.push(baseKey);
    } catch (e) {
      console.warn(`Failed to migrate storage item "${legacyKey}" — kept in place:`, e);
    }
  }

  return migrated;
}

/**
 * How often the user is told that storage is full, in milliseconds.
 *
 * One full-storage write fails several state slices in the same commit, and a
 * stack of identical toasts is worse than one warning.
 */
export const STORAGE_WARNING_INTERVAL_MS = 30_000;

/**
 * Build a throttled "storage failed" reporter.
 *
 * Extracted from the app context so the warning rule can be tested directly:
 * whether the user is told about a lost write is the whole point of this feature,
 * and it is otherwise only reachable through a rendered React tree.
 *
 * A `QuotaExceededError` is reported regardless of the throttle, because that is
 * the failure the user has to act on and it is reached through the same window
 * as any other slice: the effects run in declaration order, so a redundant write
 * of a low-value slice can fail first and would otherwise swallow the warning.
 *
 * @param onFailure invoked with the first failure in each window.
 */
export function createStorageFailureReporter(
  onFailure: (failure: StorageQuotaError) => void,
  intervalMs: number = STORAGE_WARNING_INTERVAL_MS,
  now: () => number = Date.now
): (failure: StorageQuotaError) => void {
  let lastReportedAt = Number.NEGATIVE_INFINITY;
  // A quota failure is urgent enough to be reported even inside a window that
  // another failure opened; this keeps that to one extra message per window.
  let quotaReportedInWindow = false;

  return (failure: StorageQuotaError) => {
    const current = now();
    const inWindow = current - lastReportedAt < intervalMs;

    if (inWindow) {
      if (!failure.quotaExceeded || quotaReportedInWindow) return;
      quotaReportedInWindow = true;
      onFailure(failure);
      return;
    }

    lastReportedAt = current;
    quotaReportedInWindow = failure.quotaExceeded;
    onFailure(failure);
  };
}

/**
 * User-facing message for a failed write.
 *
 * Written for the person holding the phone: it says what was lost and what to do
 * about it. `key` is only named in the non-quota case, where it helps diagnosis
 * and the user cannot act on it anyway.
 */
export function storageFailureMessage(failure: StorageQuotaError): string {
  return failure.quotaExceeded
    ? 'Thay đổi vừa rồi CHƯA được lưu và sẽ mất khi tải lại trang. Hãy xoá ảnh giao hàng cũ hoặc xuất dữ liệu ra file để giải phóng bộ nhớ.'
    : `Không lưu được "${failure.key}". Thay đổi vừa rồi có thể sẽ mất khi tải lại trang.`;
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}
