import React, { createContext, useCallback, useContext, useRef, useState, useEffect, useMemo, type ReactNode } from 'react';
import { type Product, type Customer, type CondoLocation, type Order, type StockLog, type ScreenType, type PaymentMethod, type OrderItem, type OrderLocation, type OrderPriority, type DeliveryStatus, type RecurringFrequency, calculateNextRecurringDate, type AppNotification, type NotificationType, type NotificationSchedulerConfig, DEFAULT_SCHEDULER_CONFIG, getOrderCost, type UserRole, type RoleConfig, ROLE_CONFIGS, type StaffUser, type StoreBankConfig, DEFAULT_BANK_CONFIG, type CustomerDebtSummary } from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_CONDOS,
  INITIAL_CUSTOMERS,
  INITIAL_ORDERS,
  INITIAL_STOCK_LOGS,
  INITIAL_STAFF_USERS,
  OPERATOR_USERS,
  STORAGE_KEYS,
  loadFromStorage,
  removeFromStorage,
  trySaveToStorage,
  createStorageFailureReporter,
  storageFailureMessage,
  setStorageNamespace,
  migrateLegacyStorageTo,
  getStoredActiveShopId,
  setStoredActiveShopId,
  type StorageQuotaError,
  formatVND,
} from '../utils/storage';
import { playNotificationSound } from '../utils/soundNotification';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
} from '../utils/browserNotification';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, signInWithPopup, signOut, googleProvider } from '../firebase/config';
import { subscribeToFirebaseCollections, upsertOrderFirestore, updateOrderFirestore, upsertCustomerFirestore, upsertProductFirestore, upsertCondoFirestore, addStockLogFirestore, upsertStaffUserFirestore, deleteStaffUserFirestore, upsertBankConfigFirestore, seedLocalDataToFirestoreIfEmpty, getStaffRole, requestStaffAccess, deleteStaffRequest, subscribeToStaffRole, setActiveShopId, probeAccount, createShop, joinShop, getShop, getShopMember, subscribeToMembership, updateAccountIndex, adoptLocalDocumentsIntoShop, migrateLegacyStaffRolesToMembers, type CloudCollection, type TenancyProbe, type ShopDoc, type AccountDoc, type ShopMemberDoc } from '../firebase/firestoreService';

interface AppContextType {
  // Navigation
  currentScreen: ScreenType;
  setCurrentScreen: (screen: ScreenType) => void;

  // VietQR & Store Bank Configuration
  bankConfig: StoreBankConfig;
  updateBankConfig: (updates: Partial<StoreBankConfig>) => void;

  // Staff & Role-Based Access Control (RBAC)
  staffUsers: StaffUser[];
  activeStaff: StaffUser;
  currentRole: UserRole;
  roleConfig: RoleConfig;
  setActiveStaffId: (staffId: string) => void;
  addStaffUser: (user: Omit<StaffUser, 'id' | 'createdAt'>) => void;
  updateStaffUser: (id: string, updates: Partial<StaffUser>) => void;
  deleteStaffUser: (id: string) => void;
  canAccessScreen: (screen: ScreenType) => boolean;
  isRole: (role: UserRole | UserRole[]) => boolean;

  // Current Operator / Shipper User (Backwards compatibility)
  currentUser: string;
  setCurrentUser: (user: string) => void;
  availableUsers: string[];

  // Data
  products: Product[];
  customers: Customer[];
  condos: CondoLocation[];
  orders: Order[];
  stockLogs: StockLog[];

  // Product / Inventory actions
  addProduct: (product: Omit<Product, 'id' | 'quantitySold' | 'currentStock'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  addStockReceived: (productId: string, amount: number, note?: string) => void;

  // Order actions
  createOrder: (orderData: {
    customerName: string;
    customerPhone?: string;
    items: OrderItem[];
    location: OrderLocation;
    deliveryNote?: string;
    note?: string;
    notes?: string;
    internalNote?: string;
    deliveryStatus?: DeliveryStatus;
    paymentStatus?: 'UNPAID' | 'PAID';
    paymentMethod?: PaymentMethod;
    tags?: string[];
    priority?: OrderPriority;
    cost?: number;
    price?: number;
    receiptImageUrl?: string;
    scheduledDeliveryTime?: string;
    isRecurring?: boolean;
    recurringFrequency?: RecurringFrequency;
    nextRecurringDate?: string;
    recurringActive?: boolean;
  }) => Order;
  toggleRecurringSchedule: (orderId: string, active?: boolean) => void;
  triggerRecurringOrderInstance: (orderId: string) => Order | null;
  updateRecurringFrequency: (orderId: string, frequency: RecurringFrequency) => void;
  updateOrderScheduledDeliveryTime: (orderId: string, scheduledTime?: string) => void;
  markReadyForDelivery: (orderId: string) => void;
  markOutForDelivery: (orderId: string) => void;
  updateDeliveryStatus: (orderId: string, status: DeliveryStatus, proofImage?: string) => void;
  markDelivered: (orderId: string, proofImage?: string, note?: string) => void;
  markMultipleDelivered: (orderIds: string[]) => void;
  markPaid: (orderId: string, method: PaymentMethod) => void;
  markMultiplePaid: (orderIds: string[], method: PaymentMethod, note?: string) => void;
  attachReceiptToOrder: (orderId: string, receiptImageUrl: string, note?: string) => void;
  cancelOrder: (orderId: string) => void;
  restoreOrder: (orderId: string) => void;
  reorderDeliverySequence: (orderedOrderIds: string[]) => void;

  // Notification system
  notifications: AppNotification[];
  unreadNotificationCount: number;
  activeToastNotification: AppNotification | null;
  soundEnabled: boolean;
  toggleSound: () => void;
  browserNotificationPermission: NotificationPermission | 'unsupported';
  requestNotificationPermission: () => Promise<void>;
  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotifications: () => void;
  dismissToastNotification: () => void;
  pushAlertNotification: (params: {
    type: NotificationType;
    title: string;
    message: string;
    orderId?: string;
    priority?: OrderPriority;
  }) => void;

  // Notification Scheduler system
  schedulerConfig: NotificationSchedulerConfig;
  updateSchedulerConfig: (updates: Partial<NotificationSchedulerConfig>) => void;
  runNotificationSchedulerCheck: () => {
    outForDeliveryRemindersCount: number;
    scheduledDeliveryRemindersCount: number;
    recurringGeneratedCount: number;
  };

  // Condo actions
  addCondo: (name: string, blocks: string[]) => void;
  addBlockToCondo: (condoId: string, blockName: string) => void;

  // Customer actions
  saveCustomer: (customer: Omit<Customer, 'id'>) => Customer;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;
  selectedCustomerForOrder: Customer | null;
  setSelectedCustomerForOrder: (customer: Customer | null) => void;
  calculateCustomerDebt: (cust: Customer) => CustomerDebtSummary;
  recordCustomerDebtReminder: (customerId: string, channel: 'ZALO' | 'SMS') => void;

  // Global Search
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;

  // Reset / Acceptance test helper
  resetToDemoData: () => void;

  // Firebase & Cloud Sync
  firebaseUser: User | null;
  cloudSyncStatus: 'synced' | 'syncing' | 'offline' | 'needs_auth' | 'needs_role' | 'error';
  isCloudSyncActive: boolean;
  lastCloudSyncTime: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutGoogle: () => Promise<void>;
  syncLocalToCloud: () => Promise<void>;

  // Server-assigned role (RBAC). `null` means "signed in but not yet granted a
  // role" or "not signed in" — in that case the app keeps working on local
  // data only, and cloud sync stays off.
  assignedRole: UserRole | null;
  hasPendingAccessRequest: boolean;
  canWriteCloudCollection: (collection: CloudCollection) => boolean;

  // ---- P3 tenancy: self-serve shop onboarding (spec §3, §8) --------------
  // Which rules/data world this session is in: `legacy` = Phase 1 (old
  // rules), `tenancy` = multi-tenant, null = signed out / not yet probed.
  // `shopStatus` (tenancy only): 'none' → onboarding modal, 'pending' →
  // waiting for an admin's approval (local-only), 'active' → scoped session.
  tenancyMode: 'legacy' | 'tenancy' | null;
  shopStatus: 'none' | 'pending' | 'active' | null;
  /** The signed-in user's navigation index (`accounts/{uid}`) — authz never reads it. */
  shopAccount: AccountDoc | null;
  currentShop: ShopDoc | null;
  onboardingVisible: boolean;
  showOnboarding: () => void;
  dismissOnboarding: () => void;
  /** Create the signed-in user's own shop (self-serve, 1 per account). */
  createShopAction: (name: string) => Promise<{ shopId: string; inviteCode: string }>;
  /** Request membership via an invite code → pending until approved. */
  joinShopAction: (inviteCode: string) => Promise<void>;
}

/**
 * Mirrors `isBootstrapAdmin()` in firestore.rules: the one account allowed to
 * adopt un-namespaced legacy documents and provision other accounts' indexes.
 * Kept local on purpose — the rules are the authority; this only decides
 * whether the client ATTEMPTS writes nobody else could succeed at.
 */
const BOOTSTRAP_ADMIN_EMAIL = 'khafibo@gmail.com';

/**
 * Role-aware write gate for cloud collections, mirroring firestore.rules.
 * Every role works with orders; only ADMIN and CASHIER manage customers;
 * products/condos/stockLogs/users/settings are ADMIN only.
 */
const canWriteCloudCollectionForRole = (
  collectionName: CloudCollection,
  role: UserRole | null
): boolean => {
  if (!role) return false;
  switch (collectionName) {
    case 'orders':
      return true;
    case 'customers':
      return role === 'ADMIN' || role === 'CASHIER';
    case 'products':
    case 'condos':
    case 'stockLogs':
    case 'users':
    case 'settings':
      return role === 'ADMIN';
    default:
      return false;
  }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // P3: restore this device's shop scope BEFORE the local-cache initializers
  // below run. A returning device must boot straight into its namespaced
  // cache — otherwise the (already migrated, legacy-keys-deleted) data would
  // resolve to the demo fallback until the first cloud snapshot arrives.
  // First-time visitors have no stored id: nothing happens, exactly as before.
  const bootShopId = getStoredActiveShopId();
  if (bootShopId) {
    setStorageNamespace(bootShopId);
    setActiveShopId(bootShopId);
  }

  const [currentScreen, setCurrentScreen] = useState<ScreenType>('HOME');
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  // Staff and Role-Based Access Control State
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>(() =>
    loadFromStorage<StaffUser[]>(STORAGE_KEYS.STAFF_USERS, INITIAL_STAFF_USERS)
  );
  const [activeStaffId, setActiveStaffIdState] = useState<string>(() =>
    loadFromStorage<string>(STORAGE_KEYS.ACTIVE_STAFF_ID, INITIAL_STAFF_USERS[0].id)
  );

  // Store Bank Configuration (VietQR)
  const [bankConfig, setBankConfig] = useState<StoreBankConfig>(() =>
    loadFromStorage<StoreBankConfig>(STORAGE_KEYS.BANK_CONFIG, DEFAULT_BANK_CONFIG)
  );

  // Synchronize bankConfig to local storage
  useEffect(() => {
    persist(STORAGE_KEYS.BANK_CONFIG, bankConfig);
  }, [bankConfig]);

  const updateBankConfig = (updates: Partial<StoreBankConfig>) => {
    setBankConfig((prev) => {
      const updated = { ...prev, ...updates };
      if (firebaseUser) {
        upsertBankConfigFirestore(updated).catch((err) =>
          console.error('Error saving bank config to Firestore:', err)
        );
      }
      return updated;
    });
  };

  // Synchronize staff to local storage
  useEffect(() => {
    persist(STORAGE_KEYS.STAFF_USERS, staffUsers);
  }, [staffUsers]);

  useEffect(() => {
    persist(STORAGE_KEYS.ACTIVE_STAFF_ID, activeStaffId);
  }, [activeStaffId]);

  const activeStaff: StaffUser = useMemo(() => {
    return (
      staffUsers.find((s) => s.id === activeStaffId) ||
      staffUsers[0] ||
      INITIAL_STAFF_USERS[0]
    );
  }, [staffUsers, activeStaffId]);

  // The role granted by the server (`staffRoles/{uid}`). When someone is
  // signed in, this — not the locally selected persona — decides what the app
  // allows, because it is the only role the Firestore rules can enforce.
  const [assignedRole, setAssignedRole] = useState<UserRole | null>(null);
  const [hasPendingAccessRequest, setHasPendingAccessRequest] = useState(false);

  const currentRole: UserRole = assignedRole ?? activeStaff.role;
  const roleConfig: RoleConfig = ROLE_CONFIGS[currentRole] || ROLE_CONFIGS.ADMIN;
  const currentUser: string = activeStaff.name;
  const availableUsers: string[] = useMemo(() => staffUsers.map((s) => s.name), [staffUsers]);

  const setActiveStaffId = (staffId: string) => {
    setActiveStaffIdState(staffId);
    const found = staffUsers.find((s) => s.id === staffId);
    if (found) {
      persist(STORAGE_KEYS.CURRENT_USER, found.name);
    }
  };

  const setCurrentUser = (userName: string) => {
    const found = staffUsers.find((s) => s.name === userName);
    if (found) {
      setActiveStaffIdState(found.id);
    }
  };

  const [rawProducts, setRawProducts] = useState<Omit<Product, 'quantitySold' | 'currentStock'>[]>(() => {
    const loaded = loadFromStorage<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    return loaded.map(p => {
      const fallbackCost = INITIAL_PRODUCTS.find(ip => ip.id === p.id)?.cost ?? Math.round(p.price * 0.45);
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        cost: p.cost !== undefined ? p.cost : fallbackCost,
        initialStock: p.initialStock,
        stockReceived: p.stockReceived,
        unit: p.unit || 'Phần',
      };
    });
  });

  const [condos, setCondos] = useState<CondoLocation[]>(() =>
    loadFromStorage<CondoLocation[]>(STORAGE_KEYS.CONDOS, INITIAL_CONDOS)
  );

  const [customers, setCustomers] = useState<Customer[]>(() =>
    loadFromStorage<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS)
  );

  const [selectedCustomerForOrder, setSelectedCustomerForOrder] = useState<Customer | null>(null);

  const [orders, setOrders] = useState<Order[]>(() => {
    const loaded = loadFromStorage<Order[]>(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    return loaded.map((ord) => {
      const price = ord.price !== undefined ? ord.price : ord.totalAmount;
      const cost = ord.cost !== undefined ? ord.cost : getOrderCost(ord, INITIAL_PRODUCTS);
      return {
        ...ord,
        price,
        cost,
      };
    });
  });

  const [stockLogs, setStockLogs] = useState<StockLog[]>(() =>
    loadFromStorage<StockLog[]>(STORAGE_KEYS.STOCK_LOGS, INITIAL_STOCK_LOGS)
  );

  // Push & Local Notification State
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    loadFromStorage<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, [
      {
        id: 'notif-init-1',
        type: 'READY_FOR_DELIVERY',
        orderId: 'ORD-1001',
        title: '🚀 Sẵn sàng giao hàng: ORD-1001',
        message: 'Đơn Anh Tuấn - Sunrise City B-20-10 đã sẵn sàng để giao!',
        timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
        read: true,
        priority: 'HIGH',
      },
    ])
  );

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    loadFromStorage<boolean>(STORAGE_KEYS.SOUND_ENABLED, true)
  );

  const [activeToastNotification, setActiveToastNotification] = useState<AppNotification | null>(null);

  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => getBrowserNotificationPermission());

  /**
   * Ref to the latest `pushAlertNotification`.
   *
   * `persist` is memoized with an empty dependency list so that it stays stable
   * across renders — otherwise it would be recreated on every render and change
   * the identity of every store subscription that depends on it. The ref keeps
   * the callback it calls current without that churn.
   */
  const pushAlertNotificationRef = useRef<(params: {
    type: NotificationType;
    title: string;
    message: string;
    orderId?: string;
    priority?: OrderPriority;
  }) => void>(() => {});

  /**
   * Persist a slice of state, surfacing a storage failure to the user.
   *
   * Every write of user data goes through here so that a full localStorage cannot
   * silently drop an order. The warning is throttled because one full-storage
   * write typically fails several effects in the same commit, and a stack of
   * identical toasts is worse than one.
   *
   * Must never throw: an exception from an effect aborts the sibling effects in
   * the same commit, which would stop the other slices from being saved at all.
   */
  const reportStorageFailure = useMemo(
    () =>
      createStorageFailureReporter((failure) => {
        pushAlertNotificationRef.current({
          type: 'STORAGE_FULL',
          title: '⚠️ Bộ nhớ trình duyệt đã đầy',
          message: storageFailureMessage(failure),
        });
      }),
    []
  );

  const persist = useCallback(
    (key: string, value: unknown) => {
      const failure: StorageQuotaError | null = trySaveToStorage(key, value);
      if (!failure) return;
      reportStorageFailure(failure);
    },
    [reportStorageFailure]
  );

  // Synchronize notifications
  //
  // A plain best-effort write, deliberately NOT `persist`. `persist` warns by
  // calling `pushAlertNotification`, which appends to `notifications` — so
  // routing this effect through it would re-enter this effect on every failed
  // write. Notification history is also the least important slice to save, and a
  // full storage is already reported by the user-data write that caused it.
  // It must never throw: an exception from an effect aborts the sibling effects
  // in the same commit, which would block `persist` from warning at all.
  useEffect(() => {
    trySaveToStorage(STORAGE_KEYS.NOTIFICATIONS, notifications);
  }, [notifications]);

  // Synchronize soundEnabled
  //
  // A UI preference, so a full storage should not raise a toast — but it must
  // still not throw either, or it would abort the effects that save real data.
  useEffect(() => {
    trySaveToStorage(STORAGE_KEYS.SOUND_ENABLED, soundEnabled);
  }, [soundEnabled]);

  // Auto-dismiss active floating toast notification after 5 seconds
  useEffect(() => {
    if (!activeToastNotification) return;
    const timer = setTimeout(() => {
      setActiveToastNotification(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [activeToastNotification]);

  const unreadNotificationCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const requestNotificationPermission = async () => {
    const res = await requestBrowserNotificationPermission();
    setBrowserNotificationPermission(res);
  };

  const toggleSound = () => {
    setSoundEnabled((prev) => !prev);
  };

  const dismissToastNotification = () => {
    setActiveToastNotification(null);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  // Notification Scheduler Config State
  const [schedulerConfig, setSchedulerConfig] = useState<NotificationSchedulerConfig>(() =>
    loadFromStorage<NotificationSchedulerConfig>(STORAGE_KEYS.SCHEDULER_CONFIG, DEFAULT_SCHEDULER_CONFIG)
  );

  // Same reasoning as soundEnabled: a preference, so warn/ignore rather than
  // throwing out of the effect.
  useEffect(() => {
    trySaveToStorage(STORAGE_KEYS.SCHEDULER_CONFIG, schedulerConfig);
  }, [schedulerConfig]);

  const updateSchedulerConfig = (updates: Partial<NotificationSchedulerConfig>) => {
    setSchedulerConfig((prev) => ({ ...prev, ...updates }));
  };

  const pushAlertNotification = (params: {
    type: NotificationType;
    title: string;
    message: string;
    orderId?: string;
    priority?: OrderPriority;
  }) => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: params.type,
      title: params.title,
      message: params.message,
      orderId: params.orderId,
      timestamp: new Date().toISOString(),
      read: false,
      priority: params.priority,
    };

    setNotifications((prev) => [newNotif, ...prev.slice(0, 49)]);
    setActiveToastNotification(newNotif);

    // Audio chime
    if (soundEnabled && schedulerConfig.soundAlert) {
      playNotificationSound(params.type);
    }

    // Native browser push notification
    if (schedulerConfig.desktopNotification) {
      sendBrowserNotification(params.title, {
        body: params.message,
        tag: params.orderId || newNotif.id,
        onClick: () => {
          if (params.orderId) {
            setGlobalSearchQuery(params.orderId);
          }
          if (params.type === 'READY_FOR_DELIVERY' || params.type === 'OUT_FOR_DELIVERY_DUE') {
            setCurrentScreen('DELIVERY');
          } else if (params.type === 'SCHEDULED_DELIVERY_REMINDER') {
            setCurrentScreen('HOME');
          } else {
            setCurrentScreen('ORDER_HISTORY');
          }
        },
      });
    }
  };

  // Keep the ref pointing at the current closure on every render.
  pushAlertNotificationRef.current = pushAlertNotification;

  // Synchronize currentUser
  useEffect(() => {
    persist(STORAGE_KEYS.CURRENT_USER, currentUser);
  }, [currentUser]);

  // Synchronize condos
  useEffect(() => {
    persist(STORAGE_KEYS.CONDOS, condos);
  }, [condos]);

  // Synchronize customers
  useEffect(() => {
    persist(STORAGE_KEYS.CUSTOMERS, customers);
  }, [customers]);

  // Synchronize orders
  useEffect(() => {
    persist(STORAGE_KEYS.ORDERS, orders);
  }, [orders]);

  // Synchronize stockLogs
  useEffect(() => {
    persist(STORAGE_KEYS.STOCK_LOGS, stockLogs);
  }, [stockLogs]);

  // Firebase Auth and Cloud Sync State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'synced' | 'syncing' | 'offline' | 'needs_auth' | 'needs_role' | 'error'
  >('needs_auth');
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<string | null>(null);

  // ---- P3 tenancy state (docs/MULTI-TENANT-SPEC.md §8) --------------------
  // `tenancyMode` is decided by probing `accounts/{uid}`: permission-denied
  // means the OLD rules are live and the app behaves exactly like Phase 1.
  // 'tenancy' + no shop = the onboarding world (dismissable, local-first).
  const [tenancyMode, setTenancyMode] = useState<'legacy' | 'tenancy' | null>(null);
  const [shopStatus, setShopStatus] = useState<'none' | 'pending' | 'active' | null>(null);
  const [shopAccount, setShopAccount] = useState<AccountDoc | null>(null);
  const [currentShop, setCurrentShop] = useState<ShopDoc | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  // Bumped to re-run the auth/shop flow after create/join/approval without a
  // page reload (the flow reads server state from scratch each run).
  const [authFlowNonce, setAuthFlowNonce] = useState(0);
  // --------------------------------------------------------------------------

  // Mirrors the write rules in firestore.rules. Kept next to the sync code on
  // purpose: if the rules change, this has to change with them, otherwise the
  // app attempts writes it knows will be rejected and reports a confusing
  // error for a whole batch of otherwise valid writes.
  const canWriteCloudCollection = useCallback(
    (collectionName: CloudCollection): boolean =>
      canWriteCloudCollectionForRole(collectionName, assignedRole ?? currentRole),
    [assignedRole, currentRole]
  );

  const isCloudSyncActive = Boolean(firebaseUser && cloudSyncStatus === 'synced');

  const signInWithGoogle = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      setFirebaseUser(res.user);
      setCloudSyncStatus('syncing');
    } catch (err) {
      console.error('Google Sign In error:', err);
      throw err;
    }
  };

  const signOutGoogle = async () => {
    await signOut(auth);
    setFirebaseUser(null);
    setAssignedRole(null);
    setHasPendingAccessRequest(false);
    setCloudSyncStatus('needs_auth');
  };

  // ---- P3 onboarding actions (spec §3) ----------------------------------
  // Creating a shop is open to anyone with the link (self-serve); JOINING an
  // existing shop is the only approval-gated path. Both actions re-run the
  // auth flow when they finish (no page reload needed).
  const showOnboarding = () => {
    setOnboardingDismissed(false);
    setOnboardingOpen(true);
  };

  const dismissOnboarding = () => {
    setOnboardingDismissed(true);
    setOnboardingOpen(false);
  };

  const createShopAction = async (
    name: string
  ): Promise<{ shopId: string; inviteCode: string }> => {
    if (!firebaseUser) {
      throw new Error('Bạn cần đăng nhập Google trước khi tạo cửa hàng.');
    }
    const result = await createShop({
      ownerUid: firebaseUser.uid,
      ownerEmail: firebaseUser.email ?? '',
      ownerDisplayName: firebaseUser.displayName ?? firebaseUser.email ?? '',
      name,
    });

    // Adopt the pre-tenancy cloud dataset BY PATH before the first scoped
    // seed can run: post-P4 rules deny enumerating collections by design,
    // but the owner's browser already holds every document id. Only the
    // bootstrap super-admin may perform this write (rules) — for anyone else
    // this block is skipped and the prefixed-seed path covers a fresh shop.
    if (firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL) {
      try {
        const adoption = await adoptLocalDocumentsIntoShop(result.shopId, {
          orders: orders.map((o) => o.id),
          customers: customers.map((c) => c.id),
          products: products.map((p) => p.id),
          condos: condos.map((c) => c.id),
          stockLogs: stockLogs.map((l) => l.id),
          users: staffUsers.map((u) => u.id),
        });
        console.info('[tenancy] legacy adoption:', adoption);
      } catch (err) {
        console.warn('[tenancy] legacy adoption failed (seed covers the rest):', err);
      }
    }

    // Convert legacy staffRoles → members. Copy only — the staffRoles docs
    // stay until P5 as the rollback path. A fresh account has none, and a
    // caller without an admin role cannot even list them: it no-ops.
    void migrateLegacyStaffRolesToMembers(result.shopId)
      .then((res) => console.info('[tenancy] staffRoles → members:', res))
      .catch((err) => console.warn('[tenancy] staffRoles migration failed:', err));

    setOnboardingOpen(false);
    setAuthFlowNonce((n) => n + 1);
    return result;
  };

  const joinShopAction = async (inviteCode: string): Promise<void> => {
    if (!firebaseUser) {
      throw new Error('Bạn cần đăng nhập Google trước khi tham gia cửa hàng.');
    }
    await joinShop({
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? '',
      displayName: firebaseUser.displayName ?? firebaseUser.email ?? '',
      inviteCode,
    });
    setOnboardingOpen(false);
    setAuthFlowNonce((n) => n + 1);
  };

  const syncLocalToCloud = async () => {
    if (!firebaseUser) {
      throw new Error('Vui lòng đăng nhập Google để kích hoạt đồng bộ Cloud.');
    }
    if (!assignedRole) {
      throw new Error(
        'Tài khoản chưa được phân quyền. Nhờ chủ quán duyệt trong màn hình Quản lý nhân viên.'
      );
    }
    setCloudSyncStatus('syncing');
    try {
      for (const ord of orders) {
        await upsertOrderFirestore(ord);
      }
      if (canWriteCloudCollection('customers')) {
        for (const c of customers) {
          await upsertCustomerFirestore(c);
        }
      }
      if (canWriteCloudCollection('products')) {
        for (const p of products) {
          await upsertProductFirestore(p);
        }
      }
      if (canWriteCloudCollection('condos')) {
        for (const condo of condos) {
          await upsertCondoFirestore(condo);
        }
      }
      if (canWriteCloudCollection('stockLogs')) {
        for (const l of stockLogs) {
          await addStockLogFirestore(l);
        }
      }
      if (canWriteCloudCollection('users')) {
        for (const s of staffUsers) {
          await upsertStaffUserFirestore(s);
        }
      }
      if (canWriteCloudCollection('settings')) {
        await upsertBankConfigFirestore(bankConfig);
      }
      setLastCloudSyncTime(new Date().toISOString());
      setCloudSyncStatus('synced');
    } catch (err) {
      setCloudSyncStatus('error');
      throw err;
    }
  };

  // Staff CRUD actions
  const addStaffUser = (userData: Omit<StaffUser, 'id' | 'createdAt'>) => {
    const newStaff: StaffUser = {
      ...userData,
      id: `staff-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setStaffUsers((prev) => [...prev, newStaff]);
    if (firebaseUser) {
      upsertStaffUserFirestore(newStaff).catch((err) =>
        console.error('Error saving staff to Firestore:', err)
      );
    }
  };

  const updateStaffUser = (id: string, updates: Partial<StaffUser>) => {
    setStaffUsers((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...updates };
        if (firebaseUser) {
          upsertStaffUserFirestore(updated).catch((err) =>
            console.error('Error updating staff in Firestore:', err)
          );
        }
        return updated;
      })
    );
  };

  const deleteStaffUser = (id: string) => {
    setStaffUsers((prev) => prev.filter((s) => s.id !== id));
    if (firebaseUser) {
      deleteStaffUserFirestore(id).catch((err) =>
        console.error('Error deleting staff from Firestore:', err)
      );
    }
    if (activeStaffId === id) {
      const remaining = staffUsers.filter((s) => s.id !== id);
      if (remaining.length > 0) {
        setActiveStaffIdState(remaining[0].id);
      }
    }
  };

  const canAccessScreen = (screen: ScreenType): boolean => {
    return roleConfig.allowedScreens.includes(screen);
  };

  const isRole = (role: UserRole | UserRole[]): boolean => {
    if (Array.isArray(role)) {
      return role.includes(currentRole);
    }
    return currentRole === role;
  };

  // Real-time Firestore synchronization listener
  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;
    let unsubRole: (() => void) | null = null;

    // Shared tail of BOTH flows (legacy + tenancy): the session (role, and
    // for tenancy the shop scope) is already resolved, so now the local
    // dataset seeds into an empty cloud and the subscription starts.
    // `assignedRole` flips LAST — after the listeners are registered — so an
    // effect re-run triggered by the change can cleanly unsubscribe them.
    const beginCloudSession = async (user: User, role: UserRole) => {
      if (user.uid) {
        // The legacy access request has served its purpose (if any).
        deleteStaffRequest(user.uid).catch(() => {
          /* best effort — the request may already be gone */
        });
      }

      // Point the active persona at the staff record that matches this role,
      // preferring an exact email match, so names in the UI line up with the
      // account that is actually signed in.
      const matchingStaff =
        staffUsers.find((s) => s.email && s.email === user.email) ??
        staffUsers.find((s) => s.role === role);
      if (matchingStaff) {
        setActiveStaffIdState(matchingStaff.id);
      }

      try {
        await seedLocalDataToFirestoreIfEmpty(
          { orders, customers, products, condos, stockLogs, staffUsers },
          { canWrite: (collection) => canWriteCloudCollectionForRole(collection, role) }
        );

        unsubSnapshot = subscribeToFirebaseCollections({
          onOrdersChange: (remoteOrders) => {
            if (remoteOrders && remoteOrders.length > 0) {
              setOrders(remoteOrders);
              setLastCloudSyncTime(new Date().toISOString());
              setCloudSyncStatus('synced');
            }
          },
          onCustomersChange: (remoteCust) => {
            if (remoteCust && remoteCust.length > 0) {
              setCustomers(remoteCust);
            }
          },
          onProductsChange: (remoteProds) => {
            if (remoteProds && remoteProds.length > 0) {
              setRawProducts(
                remoteProds.map((p) => ({
                  id: p.id,
                  name: p.name,
                  price: p.price,
                  cost: p.cost !== undefined ? p.cost : Math.round(p.price * 0.45),
                  initialStock: p.initialStock,
                  stockReceived: p.stockReceived,
                  unit: p.unit || 'Phần',
                }))
              );
            }
          },
          onCondosChange: (remoteCondos) => {
            if (remoteCondos && remoteCondos.length > 0) {
              setCondos(remoteCondos);
            }
          },
          onStockLogsChange: (remoteLogs) => {
            if (remoteLogs && remoteLogs.length > 0) {
              setStockLogs(remoteLogs);
            }
          },
          onStaffChange: (remoteStaff) => {
            if (remoteStaff && remoteStaff.length > 0) {
              setStaffUsers(remoteStaff);
            }
          },
          onBankConfigChange: (remoteBank) => {
            if (remoteBank && remoteBank.bankBin && remoteBank.accountNumber) {
              setBankConfig(remoteBank);
            }
          },
          onError: (err) => {
            console.warn('Real-time sync error:', err);
            setCloudSyncStatus('error');
          },
        });
        setCloudSyncStatus('synced');
      } catch (err) {
        console.error('Failed to initialize Firebase listeners:', err);
        setCloudSyncStatus('error');
      } finally {
        // Only now does the server role become the UI role (see comment at
        // the listener registration above).
        setAssignedRole(role);
        setHasPendingAccessRequest(false);
      }
    };

    // ---- P3 tenancy flow (spec §8): no shop → onboarding, pending → wait,
    // active → scope the whole data layer to the shop. Membership — never
    // the account index — decides what this client may read.
    const runTenancySession = async (user: User, account: AccountDoc | null) => {
      setTenancyMode('tenancy');
      setShopAccount(account);

      const activeShops = account?.shops ?? [];
      const pendingShops = account?.pendingShops ?? [];
      // Candidates in priority order: the remembered default first, then any
      // other active membership, then requested-but-pending shops.
      const candidates = [
        ...new Set([
          ...(account?.defaultShopId && activeShops.includes(account.defaultShopId)
            ? [account.defaultShopId]
            : []),
          ...activeShops,
          ...pendingShops,
        ]),
      ];

      let activeSid: string | null = null;
      let activeMember: ShopMemberDoc | null = null;
      let pendingSid: string | null = null;
      let pendingMember: ShopMemberDoc | null = null;
      for (const sid of candidates) {
        let m: ShopMemberDoc | null = null;
        try {
          m = await getShopMember(sid, user.uid);
        } catch (err) {
          console.warn(`Tenancy: cannot read membership of ${sid}:`, err);
        }
        if (m && m.status === 'active') {
          activeSid = sid;
          activeMember = m;
          break;
        }
        if (m && m.status === 'pending' && !pendingSid) {
          pendingSid = sid;
          pendingMember = m;
        }
      }

      const goLocalOnly = (status: 'none' | 'pending') => {
        setCurrentShop(null);
        setShopStatus(status);
        setAssignedRole(null);
        setHasPendingAccessRequest(false);
        if (unsubSnapshot) {
          unsubSnapshot();
          unsubSnapshot = null;
        }
        setCloudSyncStatus('offline');
      };

      if (!activeSid && !pendingSid) {
        // Stale index: the memberships behind it are gone (rejected or
        // revoked — `shops` can never shrink, so the pointer lingers).
        // Clear what CAN be cleared (pendingShops) and surface onboarding:
        // recovery is a fresh invite (joinShop heals the index) or being
        // re-added by the shop's admin.
        if (pendingShops.length > 0) {
          try {
            await updateAccountIndex(user.uid, { pendingShops: [] });
          } catch (err) {
            console.warn('Tenancy: could not clear stale pendingShops:', err);
          }
        }
        if (activeShops.length > 0) {
          console.warn(
            '[tenancy] account index points at a shop without membership:',
            activeShops
          );
        }
        goLocalOnly('none');
        if (!onboardingDismissed) setOnboardingOpen(true);
        return;
      }

      if (!activeSid) {
        // Waiting for an admin's decision: local-only, but watch the
        // membership so an approval or rejection lands without a reload.
        const sid = pendingSid!;
        const member = pendingMember!;
        goLocalOnly('pending');
        // A pending member may READ the shop doc — name it in the banner.
        try {
          setCurrentShop(await getShop(sid));
        } catch {
          setCurrentShop(null);
        }
        let lastSeen = `${member.status}:${member.role}`;
        unsubRole = subscribeToMembership(sid, user.uid, (live) => {
          const key = live ? `${live.status}:${live.role}` : 'gone';
          if (key === lastSeen) return;
          lastSeen = key;
          setAuthFlowNonce((n) => n + 1); // re-run: re-resolve from scratch
        });
        return;
      }

      // ---- active membership → activate the shop ------------------------
      const sid = activeSid;
      const member = activeMember!;

      // Heal the navigation index when approval outran it (approved while
      // this client was offline): one grow, allowed by the rules for self.
      if (account && !activeShops.includes(sid)) {
        try {
          await updateAccountIndex(user.uid, {
            shops: [...activeShops, sid],
            defaultShopId: account.defaultShopId || sid,
            pendingShops: pendingShops.filter((s) => s !== sid),
          });
        } catch (err) {
          console.warn('Tenancy: could not heal the account index:', err);
        }
      }
      setShopAccount(account);

      // Scope: cloud reads/writes AND the local namespace both follow the
      // shop; the device remembers it so the next boot starts scoped.
      setActiveShopId(sid);
      setStorageNamespace(sid);
      migrateLegacyStorageTo(sid);
      setStoredActiveShopId(sid);

      let shop: ShopDoc | null = null;
      try {
        shop = await getShop(sid);
      } catch (err) {
        console.warn(`Tenancy: cannot load shop ${sid}:`, err);
      }
      setCurrentShop(shop);
      setShopStatus('active');

      const role: UserRole = member.role;

      // Membership IS the revocation channel in tenancy mode: deleting the
      // member doc signs this client out immediately (Phase 1 UX).
      let lastSeen = `${member.status}:${member.role}`;
      unsubRole = subscribeToMembership(sid, user.uid, async (live) => {
        const key = live ? `${live.status}:${live.role}` : 'gone';
        if (!live || live.status !== 'active') {
          try {
            await signOut(auth);
          } catch (err) {
            console.warn('Failed to sign out after revocation:', err);
          }
          setFirebaseUser(null);
          setAssignedRole(null);
          setHasPendingAccessRequest(false);
          if (unsubSnapshot) {
            unsubSnapshot();
            unsubSnapshot = null;
          }
          if (unsubRole) {
            unsubRole();
            unsubRole = null;
          }
          setCloudSyncStatus('needs_auth');
          alert('Quyền truy cập đã bị thu hồi. Vui lòng liên hệ chủ cửa hàng để được cấp lại quyền.');
          return;
        }
        if (key !== lastSeen) {
          lastSeen = key;
          setAssignedRole(live.role); // role changed → effect re-runs
        }
      });

      await beginCloudSession(user, role);
    };

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (unsubRole) {
        unsubRole();
        unsubRole = null;
      }
      if (!user) {
        setAssignedRole(null);
        setHasPendingAccessRequest(false);
        // Namespace + device shop key deliberately SURVIVE sign-out: the
        // local cache on this device keeps showing the last shop's data
        // (local-first), and signing back in picks it up again.
        setTenancyMode(null);
        setShopStatus(null);
        setShopAccount(null);
        setCurrentShop(null);
        setOnboardingOpen(false);
        if (unsubSnapshot) {
          unsubSnapshot();
          unsubSnapshot = null;
        }
        setCloudSyncStatus('needs_auth');
        return;
      }

      setCloudSyncStatus('syncing');

      // ---- P3: which rules generation is live? --------------------------
      // `accounts/{uid}` does not exist before the P4 deploy, so a
      // permission-denied on that get is the deterministic "still
      // single-tenant" signal — no feature flag, the backend answers.
      let probe: TenancyProbe;
      try {
        probe = await probeAccount(user.uid);
      } catch (err) {
        // Cannot classify the backend (offline, …): stay local and let the
        // next sign-in/reload retry instead of guessing wrong.
        console.warn('Tenancy probe failed — staying local:', err);
        setAssignedRole(null);
        setCloudSyncStatus('error');
        return;
      }
      if (probe.mode === 'tenancy') {
        await runTenancySession(user, probe.account);
        return;
      }

      // Phase 1 single-tenant world (old rules still deployed) — unchanged.
      setTenancyMode('legacy');
      setShopStatus(null);
      setShopAccount(null);
      setCurrentShop(null);
      setOnboardingOpen(false);

      // 1. Resolve the role from the SERVER. This is the authoritative role:
      //    the Firestore rules read the same document, so the UI and the data
      //    layer can no longer disagree. A locally selected persona is only a
      //    display convenience now.
      let role: UserRole | null = null;
      try {
        const roleDoc = await getStaffRole(user.uid);
        role = roleDoc?.role ?? null;
      } catch (err) {
        console.warn('Could not resolve the assigned role:', err);
      }

      // Listen for role revocation/changes in real time.
      unsubRole = subscribeToStaffRole(user.uid, async (liveRoleDoc) => {
        const liveRole = liveRoleDoc?.role ?? null;
        if (liveRole && liveRole !== assignedRole) {
          // Role changed (e.g. upgraded by admin) — refresh session.
          setAssignedRole(liveRole);
          setHasPendingAccessRequest(false);
          return;
        }
        if (!liveRole && assignedRole) {
          // Role revoked or deleted by admin — sign out immediately.
          try {
            await signOut(auth);
          } catch (err) {
            console.warn('Failed to sign out after role revocation:', err);
          }
          setFirebaseUser(null);
          setAssignedRole(null);
          setHasPendingAccessRequest(false);
          if (unsubSnapshot) {
            unsubSnapshot();
            unsubSnapshot = null;
          }
          if (unsubRole) {
            unsubRole();
            unsubRole = null;
          }
          setCloudSyncStatus('needs_auth');
          alert('Quyền truy cập đã bị thu hồi. Vui lòng liên hệ chủ quán để được cấp lại quyền.');
        }
      });

      // 2. No role yet: ask for one, and stay on local data. Every collection
      //    would be denied anyway, so subscribing would only produce a stream
      //    of permission errors.
      if (!role) {
        setAssignedRole(null);
        setCloudSyncStatus('needs_role');
        if (unsubSnapshot) {
          unsubSnapshot();
          unsubSnapshot = null;
        }
        try {
          await requestStaffAccess({
            uid: user.uid,
            email: user.email ?? '',
            displayName: user.displayName ?? user.email ?? '',
            requestedAt: new Date().toISOString(),
          });
          setHasPendingAccessRequest(true);
        } catch (err) {
          console.warn('Could not file an access request:', err);
        }
        return;
      }

      await beginCloudSession(user, role);
    });

    return () => {
      unsubAuth();
      if (unsubRole) {
        unsubRole();
      }
      if (unsubSnapshot) {
        unsubSnapshot();
      }
    };
    // `authFlowNonce` re-runs the whole flow after create/join/approval so a
    // membership change takes effect without a page reload.
  }, [assignedRole, authFlowNonce]);


// Dynamic Product calculation:
  // Strictly prevent double deduction and stock drift.
  // Quantity sold is computed directly from active (non-cancelled) orders.
  const products: Product[] = useMemo(() => {
    // Map productId -> total active sold quantity
    const soldMap: Record<string, number> = {};
    for (const ord of orders) {
      if (ord.status === 'ACTIVE') {
        for (const item of ord.items) {
          soldMap[item.productId] = (soldMap[item.productId] || 0) + item.quantity;
        }
      }
    }

    const calculated = rawProducts.map((p) => {
      const quantitySold = soldMap[p.id] || 0;
      const currentStock = p.initialStock + p.stockReceived - quantitySold;
      return {
        ...p,
        quantitySold,
        currentStock,
      };
    });

    persist(STORAGE_KEYS.PRODUCTS, calculated);
    return calculated;
  }, [rawProducts, orders]);

  // Product Actions
  const addProduct = (newProd: Omit<Product, 'id' | 'quantitySold' | 'currentStock'>) => {
    const id = `prod-${Date.now()}`;
    setRawProducts((prev) => [...prev, { ...newProd, id }]);
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setRawProducts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        return {
          ...p,
          name: updates.name !== undefined ? updates.name : p.name,
          price: updates.price !== undefined ? updates.price : p.price,
          initialStock: updates.initialStock !== undefined ? updates.initialStock : p.initialStock,
          stockReceived: updates.stockReceived !== undefined ? updates.stockReceived : p.stockReceived,
          unit: updates.unit !== undefined ? updates.unit : p.unit,
        };
      })
    );
  };

  const addStockReceived = (productId: string, amount: number, note?: string) => {
    if (amount <= 0) return;
    const target = rawProducts.find((p) => p.id === productId);
    if (!target) return;

    setRawProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stockReceived: p.stockReceived + amount } : p))
    );

    const log: StockLog = {
      id: `log-${Date.now()}`,
      productId,
      productName: target.name,
      quantityAdded: amount,
      date: new Date().toISOString(),
      note: note || 'Nhập thêm kho',
      addedBy: currentUser,
    };
    setStockLogs((prev) => [log, ...prev]);
  };

  // Order Actions
  const createOrder = (orderData: {
    customerName: string;
    customerPhone?: string;
    items: OrderItem[];
    location: OrderLocation;
    deliveryNote?: string;
    note?: string;
    notes?: string;
    internalNote?: string;
    deliveryStatus?: DeliveryStatus;
    paymentStatus?: 'UNPAID' | 'PAID';
    paymentMethod?: PaymentMethod;
    tags?: string[];
    priority?: OrderPriority;
    cost?: number;
    price?: number;
    receiptImageUrl?: string;
    scheduledDeliveryTime?: string;
    isRecurring?: boolean;
    recurringFrequency?: RecurringFrequency;
    nextRecurringDate?: string;
    recurringActive?: boolean;
  }): Order => {
    // Generate order ID
    const count = orders.length + 1;
    const orderId = `ORD-${1000 + count}`;
    const totalAmount = orderData.items.reduce((sum, item) => sum + item.lineTotal, 0);
    const orderPrice = orderData.price !== undefined ? orderData.price : totalAmount;
    const orderCost = orderData.cost !== undefined
      ? orderData.cost
      : orderData.items.reduce((sum, item) => {
          const itemCost = item.cost !== undefined
            ? item.cost
            : (products.find((p) => p.id === item.productId)?.cost ?? Math.round(item.unitPrice * 0.45));
          return sum + itemCost * item.quantity;
        }, 0);
    const nowIso = new Date().toISOString();

    const isPaid = orderData.paymentStatus === 'PAID';
    const isRecurring = Boolean(orderData.isRecurring);
    const recurringFrequency = isRecurring ? orderData.recurringFrequency || 'WEEKLY' : undefined;
    const nextRecurringDate = isRecurring
      ? orderData.nextRecurringDate || calculateNextRecurringDate(nowIso, recurringFrequency)
      : undefined;
    const recurringActive = isRecurring ? (orderData.recurringActive !== false) : undefined;

    let orderTags = [...(orderData.tags || [])];
    if (isRecurring && !orderTags.some((t) => t.toLowerCase() === 'định kỳ' || t.toLowerCase() === 'subscription')) {
      orderTags.push('Định kỳ');
    }

    const newOrder: Order = {
      id: orderId,
      createdAt: nowIso,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      items: orderData.items,
      totalAmount,
      cost: orderCost,
      price: orderPrice,
      location: orderData.location,
      deliveryStatus: orderData.deliveryStatus || 'PENDING',
      scheduledDeliveryTime: orderData.scheduledDeliveryTime,
      scheduledReminderSent: false,
      paymentStatus: isPaid ? 'PAID' : 'UNPAID',
      paymentMethod: isPaid ? orderData.paymentMethod || 'CASH' : undefined,
      paymentTime: isPaid ? nowIso : undefined,
      paidAmount: isPaid ? totalAmount : undefined,
      paidConfirmedBy: isPaid ? currentUser : undefined,
      status: 'ACTIVE',
      deliveryNote: orderData.notes || orderData.deliveryNote,
      internalNote: orderData.internalNote,
      note: orderData.notes || orderData.note || orderData.deliveryNote || orderData.internalNote,
      notes: orderData.notes || orderData.deliveryNote || orderData.note,
      tags: orderTags,
      priority: orderData.priority || 'MEDIUM',
      receiptImageUrl: orderData.receiptImageUrl,
      isRecurring,
      recurringFrequency,
      nextRecurringDate,
      recurringActive,
    };

    setOrders((prev) => [newOrder, ...prev]);

    if (firebaseUser) {
      upsertOrderFirestore(newOrder).catch((err) => console.error('Error saving order to Firestore:', err));
    }

    // Push notification alert for new order
    pushAlertNotification({
      type: 'NEW_ORDER',
      title: `🔔 Đơn hàng mới: ${newOrder.id}`,
      message: `${newOrder.customerName} - ${newOrder.location.formattedAddress} (${formatVND(newOrder.totalAmount)})`,
      orderId: newOrder.id,
      priority: newOrder.priority,
    });

    return newOrder;
  };

  const markReadyForDelivery = (orderId: string) => {
    let targetOrder: Order | undefined;

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        targetOrder = {
          ...ord,
          deliveryStatus: 'READY_FOR_DELIVERY',
        };
        return targetOrder;
      })
    );

    if (targetOrder) {
      pushAlertNotification({
        type: 'READY_FOR_DELIVERY',
        title: `🚀 Sẵn sàng giao hàng: ${targetOrder.id}`,
        message: `Đơn của ${targetOrder.customerName} (${targetOrder.location.formattedAddress}) đã sẵn sàng để giao!`,
        orderId: targetOrder.id,
        priority: targetOrder.priority,
      });
    }
  };

  const markOutForDelivery = (orderId: string) => {
    let targetOrder: Order | undefined;
    const nowIso = new Date().toISOString();
    const dueIso = new Date(Date.now() + (schedulerConfig.outForDeliveryReminderMinutes || 20) * 60000).toISOString();

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        targetOrder = {
          ...ord,
          deliveryStatus: 'OUT_FOR_DELIVERY',
          outForDeliveryAt: ord.outForDeliveryAt || nowIso,
          deliveryDueAt: dueIso,
          dueReminderSent: false,
        };
        return targetOrder;
      })
    );

    if (targetOrder) {
      pushAlertNotification({
        type: 'READY_FOR_DELIVERY',
        title: `🚚 Đang giao hàng: ${targetOrder.id}`,
        message: `Đơn của ${targetOrder.customerName} (${targetOrder.location.formattedAddress}) đang được shipper vận chuyển! Thời gian dự kiến: ${schedulerConfig.outForDeliveryReminderMinutes} phút.`,
        orderId: targetOrder.id,
        priority: targetOrder.priority,
      });
    }
  };

  const updateDeliveryStatus = (orderId: string, status: DeliveryStatus, proofImage?: string) => {
    const nowIso = new Date().toISOString();
    const dueIso = new Date(Date.now() + (schedulerConfig.outForDeliveryReminderMinutes || 20) * 60000).toISOString();
    let updatedOrder: Order | undefined;

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        updatedOrder = {
          ...ord,
          deliveryStatus: status,
          ...(status === 'OUT_FOR_DELIVERY'
            ? {
                outForDeliveryAt: ord.outForDeliveryAt || nowIso,
                deliveryDueAt: ord.deliveryDueAt || dueIso,
                dueReminderSent: false,
              }
            : {}),
          ...(status === 'DELIVERED'
            ? {
                deliveryTime: ord.deliveryTime || nowIso,
                deliveredBy: ord.deliveredBy || currentUser,
              }
            : {}),
          ...(proofImage ? { receiptImageUrl: proofImage } : {}),
        };
        return updatedOrder;
      })
    );

    if (updatedOrder && status === 'OUT_FOR_DELIVERY') {
      pushAlertNotification({
        type: 'READY_FOR_DELIVERY',
        title: `🚚 Đang giao hàng: ${updatedOrder.id}`,
        message: `Đơn của ${updatedOrder.customerName} (${updatedOrder.location.formattedAddress}) đang trên đường giao! Thời gian dự kiến: ${schedulerConfig.outForDeliveryReminderMinutes} phút.`,
        orderId: updatedOrder.id,
        priority: updatedOrder.priority,
      });
    }
  };

  const markDelivered = (orderId: string, proofImage?: string, note?: string) => {
    const nowIso = new Date().toISOString();
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        return {
          ...ord,
          deliveryStatus: 'DELIVERED',
          deliveryTime: ord.deliveryTime || nowIso,
          deliveredBy: ord.deliveredBy || currentUser,
          ...(proofImage ? { receiptImageUrl: proofImage, proofOfDeliveryTime: nowIso } : {}),
          ...(note ? { proofOfDeliveryNote: note } : {}),
        };
      })
    );
  };

  const attachReceiptToOrder = (orderId: string, receiptImageUrl: string, note?: string) => {
    const nowIso = new Date().toISOString();
    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === orderId
          ? {
              ...ord,
              receiptImageUrl,
              proofOfDeliveryTime: ord.proofOfDeliveryTime || nowIso,
              ...(note ? { proofOfDeliveryNote: note } : {}),
            }
          : ord
      )
    );
  };

  const markMultipleDelivered = (orderIds: string[]) => {
    if (!orderIds || orderIds.length === 0) return;
    const orderIdSet = new Set(orderIds);
    const nowIso = new Date().toISOString();
    setOrders((prev) =>
      prev.map((ord) => {
        if (!orderIdSet.has(ord.id)) return ord;
        return {
          ...ord,
          deliveryStatus: 'DELIVERED',
          deliveryTime: nowIso,
          deliveredBy: currentUser,
        };
      })
    );
  };

  const markPaid = (orderId: string, method: PaymentMethod) => {
    const nowIso = new Date().toISOString();
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        return {
          ...ord,
          paymentStatus: 'PAID',
          paymentMethod: method,
          paidAmount: ord.totalAmount,
          paymentTime: nowIso,
          paidConfirmedBy: currentUser,
        };
      })
    );
  };

  const markMultiplePaid = (orderIds: string[], method: PaymentMethod, note?: string) => {
    if (!orderIds || orderIds.length === 0) return;
    const nowIso = new Date().toISOString();
    const idSet = new Set(orderIds);
    setOrders((prev) =>
      prev.map((ord) => {
        if (!idSet.has(ord.id)) return ord;
        return {
          ...ord,
          paymentStatus: 'PAID',
          paymentMethod: method,
          paidAmount: ord.totalAmount,
          paymentTime: nowIso,
          paidConfirmedBy: currentUser,
          internalNote: note
            ? ord.internalNote
              ? `${ord.internalNote} • ${note}`
              : note
            : ord.internalNote,
        };
      })
    );
  };

  const cancelOrder = (orderId: string) => {
    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? { ...ord, status: 'CANCELLED' } : ord))
    );
  };

  const restoreOrder = (orderId: string) => {
    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? { ...ord, status: 'ACTIVE' } : ord))
    );
  };

  const reorderDeliverySequence = (orderedOrderIds: string[]) => {
    const idToSeq = new Map<string, number>();
    orderedOrderIds.forEach((id, idx) => idToSeq.set(id, idx + 1));

    setOrders((prev) =>
      prev.map((ord) => {
        if (idToSeq.has(ord.id)) {
          return {
            ...ord,
            deliverySequenceIndex: idToSeq.get(ord.id),
          };
        }
        return ord;
      })
    );
  };

  const updateOrderScheduledDeliveryTime = (orderId: string, scheduledTime?: string) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        const updated = {
          ...ord,
          scheduledDeliveryTime: scheduledTime,
          scheduledReminderSent: false, // Reset reminder flag when scheduled time is set or updated
        };
        if (firebaseUser) {
          updateOrderFirestore(orderId, {
            scheduledDeliveryTime: scheduledTime || undefined,
            scheduledReminderSent: false,
          }).catch((err) => console.error('Error updating scheduled delivery time in Firestore:', err));
        }
        return updated;
      })
    );
  };

  // Recurring Order Actions
  const toggleRecurringSchedule = (orderId: string, active?: boolean) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        const newActive = active !== undefined ? active : !ord.recurringActive;
        return {
          ...ord,
          recurringActive: newActive,
        };
      })
    );
  };

  const updateRecurringFrequency = (orderId: string, frequency: RecurringFrequency) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        const nextDate = calculateNextRecurringDate(new Date().toISOString(), frequency);
        return {
          ...ord,
          isRecurring: true,
          recurringFrequency: frequency,
          nextRecurringDate: nextDate,
        };
      })
    );
  };

  const triggerRecurringOrderInstance = (orderId: string): Order | null => {
    const parentOrder = orders.find((o) => o.id === orderId);
    if (!parentOrder || !parentOrder.isRecurring) return null;

    const count = orders.length + 1;
    const newId = `ORD-${1000 + count}`;
    const nowIso = new Date().toISOString();
    const nextDate = calculateNextRecurringDate(nowIso, parentOrder.recurringFrequency || 'WEEKLY');

    // Create spawned order for today
    const spawnedOrder: Order = {
      ...parentOrder,
      id: newId,
      createdAt: nowIso,
      deliveryStatus: 'PENDING',
      deliveryTime: undefined,
      deliveredBy: undefined,
      paymentStatus: 'UNPAID',
      paymentMethod: undefined,
      paymentTime: undefined,
      paidConfirmedBy: undefined,
      paidAmount: undefined,
      status: 'ACTIVE',
      recurringParentOrderId: parentOrder.id,
      // The spawned order itself is an instance, not the recurring parent schedule
      isRecurring: false,
      tags: parentOrder.tags?.filter((t) => t.toLowerCase() !== 'định kỳ') || [],
    };

    // Update parent order's next recurrence date and add new order to the list
    setOrders((prev) => [
      spawnedOrder,
      ...prev.map((ord) =>
        ord.id === orderId
          ? {
              ...ord,
              nextRecurringDate: nextDate,
            }
          : ord
      ),
    ]);

    pushAlertNotification({
      type: 'RECURRING_ORDER_GENERATED',
      title: `🔁 Đã tạo đơn định kỳ: ${spawnedOrder.id}`,
      message: `Đã tạo đơn giao hôm nay cho ${spawnedOrder.customerName} (${spawnedOrder.location.formattedAddress}). Kỳ tiếp theo: ${nextDate}`,
      orderId: spawnedOrder.id,
      priority: spawnedOrder.priority,
    });

    return spawnedOrder;
  };

  // Notification Scheduler Logic:
  // 1. Reminds seller 30 minutes before a scheduled delivery time for pending orders
  // 2. Reminds when 'Out for Delivery' is due
  // 3. Generates or reminds when 'Recurring Order' is due
  const runNotificationSchedulerCheck = () => {
    if (!schedulerConfig.enabled) {
      return {
        outForDeliveryRemindersCount: 0,
        scheduledDeliveryRemindersCount: 0,
        recurringGeneratedCount: 0,
      };
    }

    const now = Date.now();
    const todayStr = new Date().toISOString().slice(0, 10);
    let outRemindersCount = 0;
    let scheduledRemindersCount = 0;
    let recGeneratedCount = 0;

    // 1. Check Pending orders scheduled delivery time (notifies seller 30 minutes before scheduled delivery)
    if (schedulerConfig.remindBeforeScheduledDelivery) {
      const reminderThreshold = schedulerConfig.scheduledDeliveryReminderMinutes || 30;
      const dueScheduledOrders: { order: Order; remainingMinutes: number }[] = [];

      orders.forEach((ord) => {
        if (
          ord.status === 'ACTIVE' &&
          ord.deliveryStatus === 'PENDING' &&
          !ord.scheduledReminderSent
        ) {
          const timeStr = ord.scheduledDeliveryTime || ord.deliveryDueAt;
          if (timeStr) {
            const scheduledMs = new Date(timeStr).getTime();
            if (!isNaN(scheduledMs)) {
              const diffMs = scheduledMs - now;
              const remainingMinutes = Math.round(diffMs / 60000);
              // Trigger reminder if remaining minutes is <= reminderThreshold (default 30 mins)
              // and order hasn't passed by more than 60 mins
              if (remainingMinutes <= reminderThreshold && remainingMinutes >= -60) {
                dueScheduledOrders.push({ order: ord, remainingMinutes });
              }
            }
          }
        }
      });

      if (dueScheduledOrders.length > 0) {
        scheduledRemindersCount = dueScheduledOrders.length;
        const dueIds = new Set(dueScheduledOrders.map((d) => d.order.id));
        setOrders((prev) =>
          prev.map((ord) => (dueIds.has(ord.id) ? { ...ord, scheduledReminderSent: true } : ord))
        );

        dueScheduledOrders.forEach(({ order: ord, remainingMinutes }) => {
          const scheduledDateObj = new Date(ord.scheduledDeliveryTime || ord.deliveryDueAt || '');
          const timeFormatted = !isNaN(scheduledDateObj.getTime())
            ? scheduledDateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            : '';
          const countdownLabel =
            remainingMinutes > 0
              ? `còn ${remainingMinutes} phút`
              : remainingMinutes === 0
              ? 'đã đến giờ hẹn'
              : `đã quá giờ hẹn ${Math.abs(remainingMinutes)} phút`;

          pushAlertNotification({
            type: 'SCHEDULED_DELIVERY_REMINDER',
            title: `⏰ Sắp đến giờ giao hàng: ${ord.id} (${countdownLabel})`,
            message: `Đơn của ${ord.customerName} (${ord.location.formattedAddress}) có lịch hẹn giao lúc ${timeFormatted}. Vui lòng chuẩn bị hàng và điều phối shipper!`,
            orderId: ord.id,
            priority: 'HIGH',
          });
        });
      }
    }

    // 2. Check Out for Delivery due orders
    if (schedulerConfig.remindOnOutForDeliveryDue) {
      const dueOutOrders: Order[] = [];
      orders.forEach((ord) => {
        if (
          ord.status === 'ACTIVE' &&
          ord.deliveryStatus === 'OUT_FOR_DELIVERY' &&
          !ord.dueReminderSent
        ) {
          const startTime = ord.outForDeliveryAt
            ? new Date(ord.outForDeliveryAt).getTime()
            : new Date(ord.createdAt).getTime();
          const elapsedMinutes = Math.floor(Math.max(0, now - startTime) / 60000);
          if (elapsedMinutes >= schedulerConfig.outForDeliveryReminderMinutes) {
            dueOutOrders.push(ord);
          }
        }
      });

      if (dueOutOrders.length > 0) {
        outRemindersCount = dueOutOrders.length;
        const dueIds = new Set(dueOutOrders.map((o) => o.id));
        setOrders((prev) =>
          prev.map((ord) => (dueIds.has(ord.id) ? { ...ord, dueReminderSent: true } : ord))
        );

        dueOutOrders.forEach((ord) => {
          const startTime = ord.outForDeliveryAt
            ? new Date(ord.outForDeliveryAt).getTime()
            : new Date(ord.createdAt).getTime();
          const elapsedMinutes = Math.floor(Math.max(0, Date.now() - startTime) / 60000);
          pushAlertNotification({
            type: 'OUT_FOR_DELIVERY_DUE',
            title: `⏰ Đơn đang giao đến hạn: ${ord.id}`,
            message: `Đơn của ${ord.customerName} (${ord.location.formattedAddress}) đã giao được ${elapsedMinutes} phút (mốc nhắc ${schedulerConfig.outForDeliveryReminderMinutes} phút)! Vui lòng kiểm tra shipper hoặc hoàn tất đơn.`,
            orderId: ord.id,
            priority: 'HIGH',
          });
        });
      }
    }

    // 3. Check Recurring orders due today or earlier
    const dueRecurring = orders.filter(
      (o) =>
        o.status === 'ACTIVE' &&
        o.isRecurring === true &&
        o.recurringActive !== false &&
        Boolean(o.nextRecurringDate) &&
        (o.nextRecurringDate as string) <= todayStr
    );

    if (dueRecurring.length > 0) {
      if (schedulerConfig.autoGenerateRecurringOrders) {
        dueRecurring.forEach((recOrder) => {
          const spawned = triggerRecurringOrderInstance(recOrder.id);
          if (spawned) {
            recGeneratedCount++;
          }
        });
      } else if (schedulerConfig.notifyOnRecurringGenerated) {
        dueRecurring.forEach((recOrder) => {
          const alreadyNotified = notifications.some(
            (n) =>
              n.orderId === recOrder.id &&
              n.type === 'RECURRING_ORDER_GENERATED' &&
              n.timestamp.startsWith(todayStr)
          );
          if (!alreadyNotified) {
            pushAlertNotification({
              type: 'RECURRING_ORDER_GENERATED',
              title: `🔁 Đơn định kỳ đến hạn hôm nay: ${recOrder.id}`,
              message: `Đơn định kỳ của ${recOrder.customerName} (${recOrder.location.formattedAddress}) đến kỳ giao hôm nay. Nhấn để tạo đơn ngay!`,
              orderId: recOrder.id,
              priority: recOrder.priority,
            });
            recGeneratedCount++;
          }
        });
      }
    }

    return {
      outForDeliveryRemindersCount: outRemindersCount,
      scheduledDeliveryRemindersCount: scheduledRemindersCount,
      recurringGeneratedCount: recGeneratedCount,
    };
  };

  // Notification Scheduler Background Timer (Checks every 10 seconds)
  useEffect(() => {
    if (!schedulerConfig.enabled) return;

    const initialTimer = setTimeout(() => {
      runNotificationSchedulerCheck();
    }, 1500);

    const interval = setInterval(() => {
      runNotificationSchedulerCheck();
    }, 10000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [
    schedulerConfig.enabled,
    schedulerConfig.remindBeforeScheduledDelivery,
    schedulerConfig.scheduledDeliveryReminderMinutes,
    schedulerConfig.outForDeliveryReminderMinutes,
    schedulerConfig.remindOnOutForDeliveryDue,
    schedulerConfig.autoGenerateRecurringOrders,
    schedulerConfig.notifyOnRecurringGenerated,
    orders,
  ]);

  // Condo Actions
  const addCondo = (name: string, blocks: string[]) => {
    const id = `condo-${Date.now()}`;
    setCondos((prev) => [...prev, { id, name, blocks }]);
  };

  const addBlockToCondo = (condoId: string, blockName: string) => {
    const cleanBlock = blockName.trim().toUpperCase();
    if (!cleanBlock) return;
    setCondos((prev) =>
      prev.map((c) => {
        if (c.id !== condoId) return c;
        if (c.blocks.includes(cleanBlock)) return c;
        return { ...c, blocks: [...c.blocks, cleanBlock] };
      })
    );
  };

  // Customer Actions
  const saveCustomer = (customerData: Omit<Customer, 'id'>): Customer => {
    const existing = customers.find(
      (c) => c.phone.trim() === customerData.phone.trim() && customerData.phone.trim() !== ''
    );
    if (existing) {
      const updated = { ...existing, ...customerData };
      setCustomers((prev) => prev.map((c) => (c.id === existing.id ? updated : c)));
      return updated;
    }
    const newCust: Customer = {
      ...customerData,
      id: `cust-${Date.now()}`,
    };
    setCustomers((prev) => [...prev, newCust]);
    return newCust;
  };

  const updateCustomer = (updatedCustomer: Customer) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c))
    );
  };

  const deleteCustomer = (id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  };

  const calculateCustomerDebt = (cust: Customer): CustomerDebtSummary => {
    const custPhone = cust.phone ? cust.phone.trim() : '';
    const custNameLower = cust.name ? cust.name.trim().toLowerCase() : '';

    const custOrders = orders.filter((o) => {
      if (o.status !== 'ACTIVE') return false;
      const phoneMatch = custPhone && o.customerPhone && o.customerPhone.trim() === custPhone;
      const nameMatch = o.customerName && o.customerName.trim().toLowerCase() === custNameLower;
      return Boolean(phoneMatch || nameMatch);
    });

    const unpaidOrders = custOrders
      .filter((o) => o.paymentStatus === 'UNPAID')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // Oldest first

    const paidOrders = custOrders
      .filter((o) => o.paymentStatus === 'PAID')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Newest first

    const totalDebt = unpaidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalSpent = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    const oldestUnpaidOrder = unpaidOrders[0];
    let daysSinceOldestDebt = 0;
    if (oldestUnpaidOrder) {
      const diffMs = Date.now() - new Date(oldestUnpaidOrder.createdAt).getTime();
      daysSinceOldestDebt = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    const isOverdue = daysSinceOldestDebt >= 7;
    const isOverLimit = Boolean(cust.debtLimit && cust.debtLimit > 0 && totalDebt > cust.debtLimit);

    return {
      customer: cust,
      unpaidOrders,
      paidOrders,
      totalDebt,
      totalSpent,
      totalOrdersCount: custOrders.length,
      unpaidCount: unpaidOrders.length,
      oldestUnpaidOrder,
      daysSinceOldestDebt,
      isOverdue,
      isOverLimit,
      lastReminderAt: cust.lastReminderAt,
      reminderCount: cust.reminderCount || 0,
    };
  };

  const recordCustomerDebtReminder = (customerId: string, _channel: 'ZALO' | 'SMS') => {
    const now = new Date().toISOString();
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== customerId) return c;
        return {
          ...c,
          lastReminderAt: now,
          reminderCount: (c.reminderCount || 0) + 1,
        };
      })
    );
  };

  // Reset to Demo Data
  const resetToDemoData = () => {
    removeFromStorage(STORAGE_KEYS.PRODUCTS);
    removeFromStorage(STORAGE_KEYS.CONDOS);
    removeFromStorage(STORAGE_KEYS.CUSTOMERS);
    removeFromStorage(STORAGE_KEYS.ORDERS);
    removeFromStorage(STORAGE_KEYS.STOCK_LOGS);
    removeFromStorage(STORAGE_KEYS.CURRENT_USER);
    removeFromStorage(STORAGE_KEYS.STAFF_USERS);
    removeFromStorage(STORAGE_KEYS.ACTIVE_STAFF_ID);

    setStaffUsers(INITIAL_STAFF_USERS);
    setActiveStaffIdState(INITIAL_STAFF_USERS[0].id);

    setRawProducts(
      INITIAL_PRODUCTS.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        initialStock: p.initialStock,
        stockReceived: p.stockReceived,
        unit: p.unit,
      }))
    );
    setCondos(INITIAL_CONDOS);
    setCustomers(INITIAL_CUSTOMERS);
    setOrders(INITIAL_ORDERS);
    setStockLogs(INITIAL_STOCK_LOGS);
    setSchedulerConfig(DEFAULT_SCHEDULER_CONFIG);
    setCurrentUser(OPERATOR_USERS[0]);
    setCurrentScreen('HOME');
  };

  return (
    <AppContext.Provider
      value={{
        currentScreen,
        setCurrentScreen,
        bankConfig,
        updateBankConfig,
        staffUsers,
        activeStaff,
        currentRole,
        roleConfig,
        setActiveStaffId,
        addStaffUser,
        updateStaffUser,
        deleteStaffUser,
        canAccessScreen,
        isRole,
        currentUser,
        setCurrentUser,
        availableUsers,
        products,
        customers,
        condos,
        orders,
        stockLogs,
        addProduct,
        updateProduct,
        addStockReceived,
        createOrder,
        toggleRecurringSchedule,
        triggerRecurringOrderInstance,
        updateRecurringFrequency,
        updateOrderScheduledDeliveryTime,
        markReadyForDelivery,
        markOutForDelivery,
        updateDeliveryStatus,
        markDelivered,
        markMultipleDelivered,
        markPaid,
        markMultiplePaid,
        attachReceiptToOrder,
        cancelOrder,
        restoreOrder,
        reorderDeliverySequence,
        notifications,
        unreadNotificationCount,
        activeToastNotification,
        soundEnabled,
        toggleSound,
        browserNotificationPermission,
        requestNotificationPermission,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearNotifications,
        dismissToastNotification,
        pushAlertNotification,
        schedulerConfig,
        updateSchedulerConfig,
        runNotificationSchedulerCheck,
        addCondo,
        addBlockToCondo,
        saveCustomer,
        updateCustomer,
        deleteCustomer,
        selectedCustomerForOrder,
        setSelectedCustomerForOrder,
        calculateCustomerDebt,
        recordCustomerDebtReminder,
        globalSearchQuery,
        setGlobalSearchQuery,
        resetToDemoData,
        firebaseUser,
        cloudSyncStatus,
        isCloudSyncActive,
        lastCloudSyncTime,
        signInWithGoogle,
        signOutGoogle,
        syncLocalToCloud,
        assignedRole,
        hasPendingAccessRequest,
        canWriteCloudCollection,
        tenancyMode,
        shopStatus,
        shopAccount,
        currentShop,
        onboardingVisible: onboardingOpen,
        showOnboarding,
        dismissOnboarding,
        createShopAction,
        joinShopAction,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
