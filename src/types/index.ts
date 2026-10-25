export type LocationType = 'condo' | 'external';
export type DeliveryStatus = 'PENDING' | 'READY_FOR_DELIVERY' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
export type PaymentStatus = 'UNPAID' | 'PAID';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER';
export type OrderStatus = 'ACTIVE' | 'CANCELLED';
export type OrderPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export const RECURRING_FREQUENCY_OPTIONS: {
  id: RecurringFrequency;
  label: string;
  shortLabel: string;
  intervalDays: number;
  description: string;
}[] = [
  { id: 'DAILY', label: 'Hàng ngày (Daily)', shortLabel: 'Hằng ngày', intervalDays: 1, description: 'Lặp lại mỗi ngày' },
  { id: 'WEEKLY', label: 'Hàng tuần (Weekly)', shortLabel: 'Hằng tuần', intervalDays: 7, description: 'Lặp lại cùng thứ mỗi tuần' },
  { id: 'BIWEEKLY', label: '2 tuần / lần (Bi-weekly)', shortLabel: '2 tuần/lần', intervalDays: 14, description: 'Lặp lại mỗi 2 tuần' },
  { id: 'MONTHLY', label: 'Hàng tháng (Monthly)', shortLabel: 'Hằng tháng', intervalDays: 30, description: 'Lặp lại cùng ngày mỗi tháng' },
];

export type NotificationType =
  | 'NEW_ORDER'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY_DUE'
  | 'SCHEDULED_DELIVERY_REMINDER'
  | 'RECURRING_ORDER_GENERATED'
  | 'STORAGE_FULL'
  | 'SYSTEM';

export interface AppNotification {
  id: string;
  type: NotificationType;
  orderId?: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority?: OrderPriority;
}

export interface NotificationSchedulerConfig {
  enabled: boolean;
  outForDeliveryReminderMinutes: number; // e.g. 15, 20, 30, 45 minutes
  remindOnOutForDeliveryDue: boolean;
  scheduledDeliveryReminderMinutes: number; // e.g. 15, 30, 45, 60 minutes before scheduled delivery
  remindBeforeScheduledDelivery: boolean; // Remind seller 30 mins before scheduled delivery time
  autoGenerateRecurringOrders: boolean; // Auto-generate when recurrence date arrives
  notifyOnRecurringGenerated: boolean; // Alert when recurring order is created
  soundAlert: boolean;
  desktopNotification: boolean;
}

export const DEFAULT_SCHEDULER_CONFIG: NotificationSchedulerConfig = {
  enabled: true,
  outForDeliveryReminderMinutes: 20,
  remindOnOutForDeliveryDue: true,
  scheduledDeliveryReminderMinutes: 30,
  remindBeforeScheduledDelivery: true,
  autoGenerateRecurringOrders: true,
  notifyOnRecurringGenerated: true,
  soundAlert: true,
  desktopNotification: true,
};

/**
 * Every cloud document carries the id of the shop that owns it (T1
 * multi-tenancy, see docs/MULTI-TENANT-SPEC.md).
 *
 * Optional because local-only data — which never leaves this device — has no
 * shop yet: the Firestore layer stamps the active shop's id on write, and the
 * P2 backfill stamps the pre-tenancy dataset from the owner's browser.
 */
export type ShopOwned = { shopId?: string };

export interface Product extends ShopOwned {
  id: string;
  name: string;
  price: number; // Selling price in VND
  cost?: number; // Cost / wholesale purchase price in VND (Giá vốn)
  initialStock: number;
  stockReceived: number;
  quantitySold: number;
  currentStock: number; // initialStock + stockReceived - quantitySold
  unit: string; // e.g. Phần, Ly, Chai, Hộp, Kg
}

export interface Customer extends ShopOwned {
  id: string;
  name: string;
  phone: string;
  defaultLocationType: LocationType;
  condoName?: string;
  block?: string;
  floor?: string;
  unit?: string;
  externalAddress?: string;
  deliveryNote?: string;
  notes?: string;
  debtLimit?: number; // Hạn mức công nợ tối đa (VND), ví dụ 500.000đ, 1.000.000đ
  isVip?: boolean;
  lastReminderAt?: string; // Thời điểm gần nhất đã gửi tin nhắc nợ
  reminderCount?: number; // Số lần đã gửi tin nhắc nợ
}

export interface CustomerDebtSummary {
  customer: Customer;
  unpaidOrders: Order[];
  paidOrders: Order[];
  totalDebt: number; // Tổng số tiền nợ chưa thanh toán
  totalSpent: number; // Tổng chi tiêu tích lũy
  totalOrdersCount: number;
  unpaidCount: number;
  oldestUnpaidOrder?: Order;
  daysSinceOldestDebt: number;
  isOverdue: boolean; // Có đơn nợ quá 7 ngày
  isOverLimit: boolean; // Nợ vượt hạn mức (nếu có cấu hình debtLimit)
  lastReminderAt?: string;
  reminderCount?: number;
}

export interface CondoLocation extends ShopOwned {
  id: string;
  name: string; // e.g. "Vinhomes Grand Park"
  blocks: string[]; // e.g. ["A", "B", "S1", "S2", "S3", "S5"]
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  unit: string;
  cost?: number; // Unit cost / vốn của mỗi món
  price?: number; // Selling price alias
}

export interface OrderLocation {
  type: LocationType;
  condoName?: string;
  block?: string;
  floor?: string;
  unit?: string;
  formattedAddress: string; // e.g. "B-20-10" or "128 Nguyễn Trãi, P. Bến Thành, Q.1"
  externalAddress?: string;
  deliveryNote?: string;
  notes?: string;
  placeId?: string; // Google Places ID
  standardizedAddress?: string; // Normalized full address
  district?: string; // District / Quận Huyện
  ward?: string; // Ward / Phường Xã
  city?: string; // City / Tỉnh Thành
  lat?: number; // Geolocation latitude
  lng?: number; // Geolocation longitude
}

export interface Order extends ShopOwned {
  id: string; // e.g. "ORD-1001"
  createdAt: string; // ISO string
  customerName: string;
  customerPhone?: string;
  items: OrderItem[];
  totalAmount: number;
  cost?: number; // Total order cost (Tổng giá vốn đơn hàng)
  price?: number; // Total order selling price (Tổng giá bán / doanh thu đơn hàng, defaults to totalAmount)
  location: OrderLocation;
  deliveryStatus: DeliveryStatus;
  deliveryTime?: string;
  deliveredBy?: string;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentTime?: string;
  paidConfirmedBy?: string;
  paidAmount?: number;
  status: OrderStatus;
  deliveryNote?: string;
  internalNote?: string;
  note?: string;
  notes?: string;
  tags?: string[]; // e.g. ['Urgent', 'Gift', 'Subscription']
  priority?: OrderPriority; // 'LOW' | 'MEDIUM' | 'HIGH'
  receiptImageUrl?: string; // Captured proof of delivery or scanned receipt image
  proofOfDeliveryTime?: string; // ISO string when proof-of-delivery photo was captured
  proofOfDeliveryNote?: string; // Proof note e.g. "Đặt trước cửa phòng 2010"
  isRecurring?: boolean; // Repeat delivery order
  recurringFrequency?: RecurringFrequency; // 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
  nextRecurringDate?: string; // YYYY-MM-DD
  recurringActive?: boolean; // true = schedule active, false = paused
  recurringParentOrderId?: string; // Original recurrence template ID
  outForDeliveryAt?: string; // ISO string when marked OUT_FOR_DELIVERY
  deliveryDueAt?: string; // ISO string when estimated delivery window expires
  dueReminderSent?: boolean; // Whether the scheduler has sent a due reminder
  scheduledDeliveryTime?: string; // ISO string e.g. "2026-10-11T14:30:00.000Z" when order is scheduled to be delivered
  scheduledReminderSent?: boolean; // Whether the 30-min scheduled delivery reminder has been sent
  deliverySequenceIndex?: number; // Custom drag-and-drop optimized route stop sequence index
}

/**
 * Gets the selling price of an order (defaults to order.price, falling back to order.totalAmount)
 */
export function getOrderPrice(order: Order): number {
  return order.price !== undefined ? order.price : order.totalAmount;
}

/**
 * Gets the total cost (giá vốn) of an order.
 * If order.cost is set, returns it. Otherwise computes from item costs, product master costs, or default 45% margin.
 */
export function getOrderCost(order: Order, products?: Product[]): number {
  if (order.cost !== undefined) {
    return order.cost;
  }
  if (order.items && order.items.length > 0) {
    return order.items.reduce((sum, item) => {
      if (item.cost !== undefined) {
        return sum + item.cost * item.quantity;
      }
      if (products) {
        const prod = products.find((p) => p.id === item.productId);
        if (prod && prod.cost !== undefined) {
          return sum + prod.cost * item.quantity;
        }
      }
      return sum + Math.round(item.unitPrice * 0.45) * item.quantity;
    }, 0);
  }
  return Math.round(order.totalAmount * 0.45);
}

/**
 * Calculates gross profit (Lợi nhuận gộp) for an order
 */
export function getOrderProfit(order: Order, products?: Product[]): number {
  return getOrderPrice(order) - getOrderCost(order, products);
}

/**
 * Calculates next date for recurring frequency
 */
export function calculateNextRecurringDate(baseDateStr: string = new Date().toISOString(), frequency: RecurringFrequency = 'WEEKLY'): string {
  const d = new Date(baseDateStr);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);

  if (frequency === 'DAILY') {
    d.setDate(d.getDate() + 1);
  } else if (frequency === 'WEEKLY') {
    d.setDate(d.getDate() + 7);
  } else if (frequency === 'BIWEEKLY') {
    d.setDate(d.getDate() + 14);
  } else if (frequency === 'MONTHLY') {
    d.setMonth(d.getMonth() + 1);
  }

  return d.toISOString().slice(0, 10);
}

export const ORDER_PRIORITY_OPTIONS: {
  id: OrderPriority;
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
  dotColor: string;
  textColor: string;
  borderColor: string;
  bgLight: string;
}[] = [
  {
    id: 'HIGH',
    label: 'Cao (High)',
    shortLabel: 'Cao',
    description: 'Giao gấp, ưu tiên làm ngay',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotColor: 'bg-rose-500',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-400',
    bgLight: 'bg-rose-50',
  },
  {
    id: 'MEDIUM',
    label: 'Trung bình (Medium)',
    shortLabel: 'Trung bình',
    description: 'Tiêu chuẩn, làm theo thứ tự',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotColor: 'bg-amber-500',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-400',
    bgLight: 'bg-amber-50',
  },
  {
    id: 'LOW',
    label: 'Thấp (Low)',
    shortLabel: 'Thấp',
    description: 'Linh hoạt, giao sau',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotColor: 'bg-slate-400',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-300',
    bgLight: 'bg-slate-50',
  },
];

export const PREDEFINED_ORDER_TAGS = [
  { id: 'Gift', label: 'Quà tặng (Gift)', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'Urgent', label: 'Gấp (Urgent)', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  { id: 'Regular', label: 'Thường (Regular)', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'VIP', label: 'Khách VIP', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'Subscription', label: 'Định kỳ (Subscription)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { id: 'Fragile', label: 'Dễ vỡ (Fragile)', color: 'bg-orange-100 text-orange-800 border-orange-300' },
];

export const getOrderTagColor = (tagId: string): string => {
  const predefined = PREDEFINED_ORDER_TAGS.find((p) => p.id.toLowerCase() === tagId.toLowerCase());
  if (predefined) return predefined.color;

  // Consistent pastel colors for custom tags based on string hash
  const customColors = [
    'bg-teal-100 text-teal-800 border-teal-300',
    'bg-indigo-100 text-indigo-800 border-indigo-300',
    'bg-cyan-100 text-cyan-800 border-cyan-300',
    'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
    'bg-lime-100 text-lime-800 border-lime-300',
    'bg-sky-100 text-sky-800 border-sky-300',
  ];
  let hash = 0;
  for (let i = 0; i < tagId.length; i++) {
    hash = (hash << 5) - hash + tagId.charCodeAt(i);
  }
  return customColors[Math.abs(hash) % customColors.length];
};

export interface StockLog extends ShopOwned {
  id: string;
  productId: string;
  productName: string;
  quantityAdded: number;
  date: string;
  note?: string;
  addedBy?: string;
}

export type ScreenType =
  | 'HOME'
  | 'CREATE_ORDER'
  | 'DELIVERY'
  | 'UNPAID'
  | 'INVENTORY'
  | 'REPORT'
  | 'ORDER_HISTORY'
  | 'CUSTOMERS'
  | 'STAFF_MANAGEMENT';

export type UserRole = 'ADMIN' | 'KITCHEN' | 'SHIPPER' | 'CASHIER';

export interface RoleConfig {
  role: UserRole;
  label: string;
  shortLabel: string;
  badgeClass: string;
  dotColor: string;
  description: string;
  allowedScreens: ScreenType[];
  canViewCostAndProfit: boolean;
  canManageStaff: boolean;
  canManageProducts: boolean;
  canAdjustStock: boolean;
  canDeleteOrders: boolean;
  canConfirmPayment: boolean;
  canCreateOrder: boolean;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  ADMIN: {
    role: 'ADMIN',
    label: 'Chủ quán (Admin)',
    shortLabel: 'Admin',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    dotColor: 'bg-purple-500',
    description: 'Toàn quyền quản trị hệ thống, tài chính, giá vốn, doanh thu, kho và nhân viên',
    allowedScreens: ['HOME', 'CREATE_ORDER', 'DELIVERY', 'UNPAID', 'INVENTORY', 'ORDER_HISTORY', 'REPORT', 'CUSTOMERS', 'STAFF_MANAGEMENT'],
    canViewCostAndProfit: true,
    canManageStaff: true,
    canManageProducts: true,
    canAdjustStock: true,
    canDeleteOrders: true,
    canConfirmPayment: true,
    canCreateOrder: true,
  },
  KITCHEN: {
    role: 'KITCHEN',
    label: 'Bộ phận Bếp (Kitchen)',
    shortLabel: 'Bếp',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    dotColor: 'bg-amber-500',
    description: 'Theo dõi món cần chế biến, báo sẵn sàng giao, xem ghi chú & tồn kho món',
    allowedScreens: ['HOME', 'INVENTORY', 'ORDER_HISTORY'],
    canViewCostAndProfit: false,
    canManageStaff: false,
    canManageProducts: false,
    canAdjustStock: false,
    canDeleteOrders: false,
    canConfirmPayment: false,
    canCreateOrder: false,
  },
  SHIPPER: {
    role: 'SHIPPER',
    label: 'Giao hàng (Shipper)',
    shortLabel: 'Shipper',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    dotColor: 'bg-blue-500',
    description: 'Nhận đơn đi giao, chụp ảnh bằng chứng giao hàng (POD), gọi khách, thu tiền COD',
    allowedScreens: ['DELIVERY', 'HOME', 'ORDER_HISTORY'],
    canViewCostAndProfit: false,
    canManageStaff: false,
    canManageProducts: false,
    canAdjustStock: false,
    canDeleteOrders: false,
    canConfirmPayment: true,
    canCreateOrder: false,
  },
  CASHIER: {
    role: 'CASHIER',
    label: 'Thu ngân / Bán hàng',
    shortLabel: 'Thu ngân',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    dotColor: 'bg-emerald-500',
    description: 'Tạo đơn hàng, quản lý danh bạ khách, in hóa đơn, xác nhận thanh toán chuyển khoản & tiền mặt',
    allowedScreens: ['HOME', 'CREATE_ORDER', 'UNPAID', 'CUSTOMERS', 'ORDER_HISTORY'],
    canViewCostAndProfit: false,
    canManageStaff: false,
    canManageProducts: false,
    canAdjustStock: false,
    canDeleteOrders: false,
    canConfirmPayment: true,
    canCreateOrder: true,
  },
};

export interface StaffUser extends ShopOwned {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  phone?: string;
  active: boolean;
  avatar?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface StoreBankConfig extends ShopOwned {
  bankBin: string; // e.g. "970422" (MB Bank)
  bankCode: string; // e.g. "MB"
  bankName: string; // e.g. "MBBank - Ngân hàng Quân Đội"
  accountNumber: string; // e.g. "0901234567"
  accountHolder: string; // e.g. "NGUYEN THI HOA"
  qrTemplate: 'compact2' | 'compact' | 'qr_only' | 'print';
}

export const DEFAULT_BANK_CONFIG: StoreBankConfig = {
  bankBin: '970422',
  bankCode: 'MB',
  bankName: 'MBBank - Ngân hàng Quân Đội',
  accountNumber: '0901234567',
  accountHolder: 'CHU SHOP HOA',
  qrTemplate: 'compact2',
};
