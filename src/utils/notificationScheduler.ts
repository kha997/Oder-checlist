import { Order, NotificationSchedulerConfig, calculateNextRecurringDate } from '../types';

export interface DeliveryDueStatus {
  elapsedMinutes: number;
  dueMinutes: number;
  remainingMinutes: number;
  isDue: boolean;
  isOverdue: boolean;
  formattedText: string;
}

/**
 * Calculates delivery timing status for an order that is currently OUT_FOR_DELIVERY.
 */
export function getOrderDeliveryDueStatus(
  order: Order,
  defaultReminderMinutes: number = 20
): DeliveryDueStatus | null {
  if (order.deliveryStatus !== 'OUT_FOR_DELIVERY') {
    return null;
  }

  const now = Date.now();
  const startTime = order.outForDeliveryAt
    ? new Date(order.outForDeliveryAt).getTime()
    : new Date(order.createdAt).getTime();

  const elapsedMs = Math.max(0, now - startTime);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  const dueMinutes = defaultReminderMinutes;
  const remainingMinutes = dueMinutes - elapsedMinutes;
  const isDue = elapsedMinutes >= dueMinutes;
  const isOverdue = elapsedMinutes > dueMinutes;

  let formattedText = '';
  if (isOverdue) {
    const overdueMin = elapsedMinutes - dueMinutes;
    formattedText = `Quá hạn ${overdueMin} phút`;
  } else if (remainingMinutes === 0) {
    formattedText = 'Đến giờ giao!';
  } else {
    formattedText = `Còn ${remainingMinutes} phút`;
  }

  return {
    elapsedMinutes,
    dueMinutes,
    remainingMinutes,
    isDue,
    isOverdue,
    formattedText,
  };
}

/**
 * Checks which active recurring orders are due for delivery today or earlier.
 */
export function getDueRecurringOrders(
  orders: Order[],
  targetDateStr: string = new Date().toISOString().slice(0, 10)
): Order[] {
  return orders.filter(
    (o) =>
      o.status === 'ACTIVE' &&
      o.isRecurring === true &&
      o.recurringActive !== false &&
      Boolean(o.nextRecurringDate) &&
      (o.nextRecurringDate as string) <= targetDateStr
  );
}
