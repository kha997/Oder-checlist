import { Product, Customer, CondoLocation, Order, StockLog } from '../types';

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
  NOTIFICATIONS: 'oder_checklist_notifications_v1',
  SOUND_ENABLED: 'oder_checklist_sound_enabled_v1',
  SCHEDULER_CONFIG: 'oder_checklist_scheduler_config_v1',
};

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item) as T;
  } catch (e) {
    console.warn(`Failed to parse storage item "${key}":`, e);
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save to storage "${key}":`, e);
  }
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}
