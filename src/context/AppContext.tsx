import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  Product,
  Customer,
  CondoLocation,
  Order,
  StockLog,
  ScreenType,
  PaymentMethod,
  OrderItem,
  OrderLocation,
  OrderPriority,
  DeliveryStatus,
  RecurringFrequency,
  calculateNextRecurringDate,
  AppNotification,
  NotificationType,
  NotificationSchedulerConfig,
  DEFAULT_SCHEDULER_CONFIG,
  getOrderPrice,
  getOrderCost,
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_CONDOS,
  INITIAL_CUSTOMERS,
  INITIAL_ORDERS,
  INITIAL_STOCK_LOGS,
  OPERATOR_USERS,
  STORAGE_KEYS,
  loadFromStorage,
  saveToStorage,
  formatVND,
} from '../utils/storage';
import { playNotificationSound } from '../utils/soundNotification';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
} from '../utils/browserNotification';

interface AppContextType {
  // Navigation
  currentScreen: ScreenType;
  setCurrentScreen: (screen: ScreenType) => void;

  // Current Operator / Shipper User
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
    isRecurring?: boolean;
    recurringFrequency?: RecurringFrequency;
    nextRecurringDate?: string;
    recurringActive?: boolean;
  }) => Order;
  toggleRecurringSchedule: (orderId: string, active?: boolean) => void;
  triggerRecurringOrderInstance: (orderId: string) => Order | null;
  updateRecurringFrequency: (orderId: string, frequency: RecurringFrequency) => void;
  markReadyForDelivery: (orderId: string) => void;
  markOutForDelivery: (orderId: string) => void;
  updateDeliveryStatus: (orderId: string, status: DeliveryStatus, proofImage?: string) => void;
  markDelivered: (orderId: string, proofImage?: string, note?: string) => void;
  markMultipleDelivered: (orderIds: string[]) => void;
  markPaid: (orderId: string, method: PaymentMethod) => void;
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
  runNotificationSchedulerCheck: () => { outForDeliveryRemindersCount: number; recurringGeneratedCount: number };

  // Condo actions
  addCondo: (name: string, blocks: string[]) => void;
  addBlockToCondo: (condoId: string, blockName: string) => void;

  // Customer actions
  saveCustomer: (customer: Omit<Customer, 'id'>) => Customer;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;
  selectedCustomerForOrder: Customer | null;
  setSelectedCustomerForOrder: (customer: Customer | null) => void;

  // Global Search
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;

  // Reset / Acceptance test helper
  resetToDemoData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('HOME');
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<string>(() =>
    loadFromStorage(STORAGE_KEYS.CURRENT_USER, OPERATOR_USERS[0])
  );

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

  // Synchronize notifications
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, notifications);
  }, [notifications]);

  // Synchronize soundEnabled
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SOUND_ENABLED, soundEnabled);
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

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SCHEDULER_CONFIG, schedulerConfig);
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
          if (params.type === 'READY_FOR_DELIVERY' || params.type === 'OUT_FOR_DELIVERY_DUE') {
            setCurrentScreen('DELIVERY');
          } else {
            setCurrentScreen('ORDER_HISTORY');
          }
        },
      });
    }
  };

  // Synchronize currentUser
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CURRENT_USER, currentUser);
  }, [currentUser]);

  // Synchronize condos
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CONDOS, condos);
  }, [condos]);

  // Synchronize customers
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);
  }, [customers]);

  // Synchronize orders
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ORDERS, orders);
  }, [orders]);

  // Synchronize stockLogs
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.STOCK_LOGS, stockLogs);
  }, [stockLogs]);

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

    saveToStorage(STORAGE_KEYS.PRODUCTS, calculated);
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

  // Notification Scheduler Logic: Reminds when 'Out for Delivery' is due or 'Recurring Order' is generated
  const runNotificationSchedulerCheck = () => {
    if (!schedulerConfig.enabled) {
      return { outForDeliveryRemindersCount: 0, recurringGeneratedCount: 0 };
    }

    const now = Date.now();
    const todayStr = new Date().toISOString().slice(0, 10);
    let outRemindersCount = 0;
    let recGeneratedCount = 0;

    // 1. Check Out for Delivery due orders
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

    // 2. Check Recurring orders due today or earlier
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

  // Reset to Demo Data
  const resetToDemoData = () => {
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.CONDOS);
    localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_LOGS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);

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
        currentUser,
        setCurrentUser,
        availableUsers: OPERATOR_USERS,
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
        markReadyForDelivery,
        markOutForDelivery,
        updateDeliveryStatus,
        markDelivered,
        markMultipleDelivered,
        markPaid,
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
        globalSearchQuery,
        setGlobalSearchQuery,
        resetToDemoData,
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
