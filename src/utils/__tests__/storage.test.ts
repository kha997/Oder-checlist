import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORAGE_KEYS,
  StorageQuotaError,
  createStorageFailureReporter,
  getStorageNamespace,
  loadFromStorage,
  migrateLegacyStorageTo,
  removeFromStorage,
  saveToStorage,
  scopedStorageKey,
  setStorageNamespace,
  storageFailureMessage,
  trySaveToStorage,
} from '../storage';

/**
 * StorageQuotaError exists because a full localStorage used to fail silently:
 * the UI kept the change in React state, the write never happened, and the user
 * only found out after a reload.
 */
describe('saveToStorage', () => {
  let store: Map<string, string>;
  let setItem: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = new Map();
    setItem = vi.fn((key: string, value: string) => {
      store.set(key, value);
    });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem,
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('writes JSON-serialised values', () => {
    saveToStorage('orders', [{ id: 'OD-1' }]);
    expect(JSON.parse(store.get('orders')!)).toEqual([{ id: 'OD-1' }]);
  });

  it('throws StorageQuotaError instead of swallowing a QuotaExceededError', () => {
    // Chrome/Safari name, and the code they use to signal it.
    setItem.mockImplementation(() => {
      const err = new DOMException('quota', 'QuotaExceededError');
      throw err;
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => saveToStorage('orders', [])).toThrow(StorageQuotaError);
  });

  it('flags quotaExceeded and names the key that failed', () => {
    setItem.mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      saveToStorage('oder_checklist_orders_v1', []);
      expect.unreachable('saveToStorage should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(StorageQuotaError);
      const err = e as StorageQuotaError;
      expect(err.quotaExceeded).toBe(true);
      expect(err.key).toBe('oder_checklist_orders_v1');
      // The message must be actionable, since it is shown to the user verbatim.
      expect(err.message).toContain('đầy');
      expect(err.message).toContain('mất khi tải lại trang');
    }
  });

  it('recognises the Firefox spelling (NS_ERROR_DOM_QUOTA_REACHED)', () => {
    setItem.mockImplementation(() => {
      throw new DOMException('quota', 'NS_ERROR_DOM_QUOTA_REACHED');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const failure = trySaveToStorage('orders', []);
    expect(failure?.quotaExceeded).toBe(true);
  });

  it('recognises the legacy numeric code 22 when the name is generic', () => {
    setItem.mockImplementation(() => {
      // Older engines reported code 22 with a non-standard name.
      const err = new DOMException('quota');
      Object.defineProperty(err, 'code', { value: 22 });
      throw err;
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(trySaveToStorage('orders', [])?.quotaExceeded).toBe(true);
  });

  it('does not claim the quota is the cause when it is a different failure', () => {
    setItem.mockImplementation(() => {
      throw new TypeError('localStorage is not a function');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const failure = trySaveToStorage('orders', []);
    expect(failure).toBeInstanceOf(StorageQuotaError);
    expect(failure?.quotaExceeded).toBe(false);
    expect(failure?.message).not.toContain('đầy');
  });

  it('still logs the underlying error for debugging', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setItem.mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    trySaveToStorage('orders', []);
    expect(spy).toHaveBeenCalledWith('Failed to save to storage "orders":', expect.anything());
  });
});

describe('createStorageFailureReporter', () => {
  const failure = (key: string, quota = true) => new StorageQuotaError(key, quota, null);

  it('reports the first failure', () => {
    const seen: StorageQuotaError[] = [];
    const report = createStorageFailureReporter((f) => seen.push(f), 30_000, () => 0);
    report(failure('orders'));
    expect(seen).toHaveLength(1);
    expect(seen[0].key).toBe('orders');
  });

  it('suppresses failures inside the interval', () => {
    // One full-storage write fails several state slices in the same commit; the
    // user must not get a stack of identical toasts.
    const seen: StorageQuotaError[] = [];
    const report = createStorageFailureReporter((f) => seen.push(f), 30_000, () => 1_000);
    report(failure('orders'));
    report(failure('customers'));
    report(failure('products'));
    expect(seen).toHaveLength(1);
  });

  it('reports again once the interval has elapsed', () => {
    const seen: StorageQuotaError[] = [];
    let clock = 0;
    const report = createStorageFailureReporter((f) => seen.push(f), 30_000, () => clock);
    report(failure('orders'));
    clock = 29_999;
    report(failure('orders'));
    expect(seen).toHaveLength(1);
    clock = 30_000;
    report(failure('orders'));
    expect(seen).toHaveLength(2);
  });

  it('reports the failure itself, not just a count, so the message can name the key', () => {
    const seen: StorageQuotaError[] = [];
    const report = createStorageFailureReporter((f) => seen.push(f), 30_000, () => 0);
    report(failure('oder_checklist_orders_v1', false));
    expect(seen[0].key).toBe('oder_checklist_orders_v1');
    expect(seen[0].quotaExceeded).toBe(false);
  });

  it('still reports a quota failure inside a window opened by a lesser failure', () => {
    // Effects run in declaration order, so a redundant write of a low-value
    // slice can fail first. The urgent failure must not be swallowed by it.
    const seen: StorageQuotaError[] = [];
    const report = createStorageFailureReporter((f) => seen.push(f), 30_000, () => 0);
    report(failure('sound', false));
    report(failure('orders', true));
    expect(seen.map((f) => f.key)).toEqual(['sound', 'orders']);
  });

  it('reports the urgent failure only once per window', () => {
    const seen: StorageQuotaError[] = [];
    const report = createStorageFailureReporter((f) => seen.push(f), 30_000, () => 0);
    report(failure('orders', true));
    report(failure('customers', true));
    report(failure('products', true));
    expect(seen).toHaveLength(1);
  });
});

describe('storageFailureMessage', () => {
  it('tells the user what to do when the quota is the cause', () => {
    const message = storageFailureMessage(new StorageQuotaError('orders', true, null));
    expect(message).toContain('CHƯA được lưu');
    expect(message).toContain('mất khi tải lại trang');
    expect(message).toContain('xoá ảnh giao hàng cũ');
  });

  it('names the key for a non-quota failure, where the cause is diagnosable', () => {
    const message = storageFailureMessage(new StorageQuotaError('oder_checklist_orders_v1', false, null));
    expect(message).toContain('oder_checklist_orders_v1');
    expect(message).not.toContain('xoá ảnh giao hàng cũ');
  });
});

describe('trySaveToStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null on success so callers can branch on the result', () => {
    expect(trySaveToStorage('sound', true)).toBeNull();
  });
});

describe('loadFromStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to the default when the key is absent', () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(loadFromStorage('missing', 'fallback')).toBe('fallback');
  });

  it('falls back to the default when the stored value is corrupt', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{not json' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(loadFromStorage('broken', { ok: true })).toEqual({ ok: true });
  });

  it('round-trips a stored value', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ ok: true }) });
    expect(loadFromStorage('good', { ok: false })).toEqual({ ok: true });
  });
});

/**
 * T1 multi-tenancy: the local cache is namespaced per shop, or two shops on
 * one device share a single set of keys and overwrite each other's data.
 *
 * The empty namespace must be byte-identical to the pre-tenancy behaviour:
 * until a shop is actually selected, nothing about storage may change.
 */
describe('storage namespace (T1)', () => {
  let store: Map<string, string>;
  let setItem: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = new Map();
    setItem = vi.fn((key: string, value: string) => {
      store.set(key, value);
    });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem,
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    });
    setStorageNamespace('');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setStorageNamespace('');
  });

  it('leaves keys byte-identical while no shop is selected', () => {
    expect(scopedStorageKey(STORAGE_KEYS.ORDERS)).toBe(STORAGE_KEYS.ORDERS);
    saveToStorage(STORAGE_KEYS.ORDERS, [{ id: 'ORD-1' }]);
    expect(store.has(STORAGE_KEYS.ORDERS)).toBe(true);
    expect(loadFromStorage(STORAGE_KEYS.ORDERS, [])).toEqual([{ id: 'ORD-1' }]);
    expect(getStorageNamespace()).toBe('');
  });

  it('reads and writes only inside the active namespace', () => {
    setStorageNamespace('shp_alpha');
    saveToStorage(STORAGE_KEYS.ORDERS, [{ id: 'A' }]);
    expect(store.has(`${STORAGE_KEYS.ORDERS}@shp_alpha`)).toBe(true);
    expect(store.has(STORAGE_KEYS.ORDERS)).toBe(false);
    expect(loadFromStorage(STORAGE_KEYS.ORDERS, [])).toEqual([{ id: 'A' }]);
  });

  it('keeps two shops on one device fully separate', () => {
    setStorageNamespace('shp_alpha');
    saveToStorage(STORAGE_KEYS.ORDERS, [{ id: 'A' }]);
    setStorageNamespace('shp_beta');
    // A new shop starts with an EMPTY cache — it must never see shop A's data.
    expect(loadFromStorage(STORAGE_KEYS.ORDERS, [])).toEqual([]);
    saveToStorage(STORAGE_KEYS.ORDERS, [{ id: 'B' }]);
    setStorageNamespace('shp_alpha');
    expect(loadFromStorage(STORAGE_KEYS.ORDERS, [])).toEqual([{ id: 'A' }]);
    expect(store.get(`${STORAGE_KEYS.ORDERS}@shp_beta`)).toBe(JSON.stringify([{ id: 'B' }]));
  });

  it('removeFromStorage clears only the active namespace entry', () => {
    setStorageNamespace('shp_alpha');
    saveToStorage(STORAGE_KEYS.ORDERS, [{ id: 'A' }]);
    setStorageNamespace('shp_beta');
    saveToStorage(STORAGE_KEYS.ORDERS, [{ id: 'B' }]);

    removeFromStorage(STORAGE_KEYS.ORDERS);

    expect(store.has(`${STORAGE_KEYS.ORDERS}@shp_beta`)).toBe(false);
    expect(store.has(`${STORAGE_KEYS.ORDERS}@shp_alpha`)).toBe(true);
  });

  describe('migrateLegacyStorageTo', () => {
    it('moves legacy data into the namespace — nothing is lost, nothing duplicated', () => {
      store.set(STORAGE_KEYS.ORDERS, JSON.stringify([{ id: 'legacy' }]));
      store.set(STORAGE_KEYS.SOUND_ENABLED, 'true');

      const migrated = migrateLegacyStorageTo('shp_alpha');

      expect(migrated.sort()).toEqual(
        [STORAGE_KEYS.ORDERS, STORAGE_KEYS.SOUND_ENABLED].sort()
      );
      expect(store.get(`${STORAGE_KEYS.ORDERS}@shp_alpha`)).toBe(
        JSON.stringify([{ id: 'legacy' }])
      );
      // The copy must go: a duplicated key set can itself blow the ~5 MB quota.
      expect(store.has(STORAGE_KEYS.ORDERS)).toBe(false);
    });

    it('is idempotent — a second run finds nothing to migrate', () => {
      store.set(STORAGE_KEYS.ORDERS, JSON.stringify([{ id: 'legacy' }]));
      expect(migrateLegacyStorageTo('shp_alpha')).toHaveLength(1);
      expect(migrateLegacyStorageTo('shp_alpha')).toEqual([]);
    });

    it("never overwrites data already living in the shop's namespace", () => {
      store.set(STORAGE_KEYS.ORDERS, JSON.stringify([{ id: 'legacy' }]));
      store.set(`${STORAGE_KEYS.ORDERS}@shp_alpha`, JSON.stringify([{ id: 'shopdata' }]));

      const migrated = migrateLegacyStorageTo('shp_alpha');

      expect(migrated).not.toContain(STORAGE_KEYS.ORDERS);
      expect(JSON.parse(store.get(`${STORAGE_KEYS.ORDERS}@shp_alpha`)!)).toEqual([
        { id: 'shopdata' },
      ]);
      // The skipped legacy copy stays put as a rollback artefact.
      expect(store.has(STORAGE_KEYS.ORDERS)).toBe(true);
    });

    it('keeps the legacy copy when the namespaced write fails (quota)', () => {
      store.set(STORAGE_KEYS.ORDERS, JSON.stringify([{ id: 'legacy' }]));
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      setItem.mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });

      const migrated = migrateLegacyStorageTo('shp_alpha');

      expect(migrated).toEqual([]);
      expect(store.has(STORAGE_KEYS.ORDERS)).toBe(true);
    });

    it('does nothing without a namespace', () => {
      store.set(STORAGE_KEYS.ORDERS, JSON.stringify([{ id: 'legacy' }]));
      expect(migrateLegacyStorageTo('')).toEqual([]);
      expect(store.has(STORAGE_KEYS.ORDERS)).toBe(true);
    });
  });
});
