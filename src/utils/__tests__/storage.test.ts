import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  StorageQuotaError,
  createStorageFailureReporter,
  loadFromStorage,
  saveToStorage,
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
