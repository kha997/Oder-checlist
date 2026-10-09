import { Order } from '../types';

/**
 * Remove Vietnamese accents/diacritics for flexible search
 * e.g. "Hương" -> "huong", "Tuấn" -> "tuan", "Đà Nẵng" -> "da nang"
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

export interface OrderSearchMatch {
  order: Order;
  matched: boolean;
  matchType: 'ID' | 'CUSTOMER_NAME' | 'PHONE' | 'ADDRESS';
  highlightField: 'id' | 'customerName' | 'customerPhone' | 'address';
}

/**
 * Searches orders by customer name, order ID, phone number or address.
 * Prioritizes Customer Name and Order ID matches as primary requirements.
 */
export function searchOrders(orders: Order[], query: string): OrderSearchMatch[] {
  const rawQ = query.trim().toLowerCase();
  if (!rawQ) return [];

  const cleanQ = removeVietnameseTones(query);

  const results: OrderSearchMatch[] = [];

  for (const order of orders) {
    if (order.status !== 'ACTIVE') continue;

    const rawId = order.id.toLowerCase();
    const rawCustomerName = (order.customerName || '').toLowerCase();
    const cleanCustomerName = removeVietnameseTones(order.customerName || '');
    const rawPhone = (order.customerPhone || '').toLowerCase();
    const rawAddress = (order.location?.formattedAddress || '').toLowerCase();
    const cleanAddress = removeVietnameseTones(order.location?.formattedAddress || '');
    const cleanExtAddress = removeVietnameseTones(order.location?.externalAddress || '');

    // 1. Order ID Match (e.g. "ORD-1001" or "1001")
    if (rawId.includes(rawQ) || rawId.replace(/[^0-9]/g, '').includes(rawQ)) {
      results.push({
        order,
        matched: true,
        matchType: 'ID',
        highlightField: 'id',
      });
      continue;
    }

    // 2. Customer Name Match (supports with or without Vietnamese diacritics)
    if (rawCustomerName.includes(rawQ) || cleanCustomerName.includes(cleanQ)) {
      results.push({
        order,
        matched: true,
        matchType: 'CUSTOMER_NAME',
        highlightField: 'customerName',
      });
      continue;
    }

    // 3. Customer Phone Match
    if (rawPhone && rawPhone.includes(rawQ)) {
      results.push({
        order,
        matched: true,
        matchType: 'PHONE',
        highlightField: 'customerPhone',
      });
      continue;
    }

    // 4. Address Match (e.g. "B-20-10", "B-15", etc.)
    if (
      rawAddress.includes(rawQ) ||
      cleanAddress.includes(cleanQ) ||
      cleanExtAddress.includes(cleanQ)
    ) {
      results.push({
        order,
        matched: true,
        matchType: 'ADDRESS',
        highlightField: 'address',
      });
      continue;
    }
  }

  // Sort results: ID and Customer Name matches first, then by date descending
  return results.sort((a, b) => {
    const priorityScore = (m: OrderSearchMatch) => {
      if (m.matchType === 'ID') return 3;
      if (m.matchType === 'CUSTOMER_NAME') return 2;
      return 1;
    };
    const diff = priorityScore(b) - priorityScore(a);
    if (diff !== 0) return diff;
    return new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime();
  });
}
