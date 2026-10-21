import { type Order } from '../types';

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

export type OrderSearchMatchType =
  | 'ID'
  | 'CUSTOMER_NAME'
  | 'ADDRESS'
  | 'PHONE'
  | 'ITEM'
  | 'NOTE';

export interface OrderSearchMatch {
  order: Order;
  matched: boolean;
  matchType: OrderSearchMatchType;
  highlightField: 'id' | 'customerName' | 'customerPhone' | 'address' | 'items' | 'notes';
  matchedSnippet?: string;
  score: number;
}

/**
 * Searches orders by customer name, address/condo unit, order ID, phone number, items or notes.
 * Prioritizes Order ID, Customer Name, and Address/Condo Unit matches as primary requirements.
 */
export function searchOrders(orders: Order[], query: string): OrderSearchMatch[] {
  const rawQ = query.trim().toLowerCase();
  if (!rawQ) return [];

  const cleanQ = removeVietnameseTones(query);
  const qDigits = rawQ.replace(/[^0-9]/g, '');

  const results: OrderSearchMatch[] = [];

  for (const order of orders) {
    if (order.status !== 'ACTIVE') continue;

    const rawId = order.id.toLowerCase();
    const idDigits = rawId.replace(/[^0-9]/g, '');

    const rawCustomerName = (order.customerName || '').toLowerCase();
    const cleanCustomerName = removeVietnameseTones(order.customerName || '');

    const rawPhone = (order.customerPhone || '').replace(/\D/g, '');

    // Comprehensive address parts
    const loc = order.location || {};
    const formattedAddr = loc.formattedAddress || '';
    const cleanFormattedAddr = removeVietnameseTones(formattedAddr);

    const extAddr = loc.externalAddress || '';
    const cleanExtAddr = removeVietnameseTones(extAddr);

    const condoName = loc.condoName || '';
    const cleanCondoName = removeVietnameseTones(condoName);

    const block = loc.block || '';
    const cleanBlock = removeVietnameseTones(block);

    const floor = loc.floor || '';
    const unit = loc.unit || '';

    // Synthetic room representations: e.g. "B-20-10", "B2010", "B-2010", "2010", "P.10", "Tầng 20"
    const combinedAddrString = [
      formattedAddr,
      extAddr,
      condoName,
      block ? `Toà ${block} Tháp ${block} Block ${block}` : '',
      floor ? `Tầng ${floor} F${floor}` : '',
      unit ? `Phòng ${unit} P${unit} Căn ${unit}` : '',
      block && unit ? `${block}-${unit} ${block}${unit}` : '',
      block && floor && unit ? `${block}-${floor}-${unit}` : '',
      loc.district || '',
      loc.ward || '',
      loc.city || '',
    ]
      .filter(Boolean)
      .join(' ');
    const cleanCombinedAddr = removeVietnameseTones(combinedAddrString);

    // Items summary for item search
    const itemsStr = (order.items || [])
      .map((i) => `${i.productName} ${i.quantity}`)
      .join(' ');
    const cleanItemsStr = removeVietnameseTones(itemsStr);

    // Notes
    const notesStr = [
      order.deliveryNote,
      order.internalNote,
      order.note,
      order.notes,
      order.proofOfDeliveryNote,
    ]
      .filter(Boolean)
      .join(' ');
    const cleanNotesStr = removeVietnameseTones(notesStr);

    let matchType: OrderSearchMatchType | null = null;
    let highlightField: OrderSearchMatch['highlightField'] = 'customerName';
    let matchedSnippet = '';
    let score = 0;

    // 1. ORDER ID MATCH (e.g. "ORD-1001", "ord", "1001", "101")
    if (rawId === rawQ) {
      matchType = 'ID';
      highlightField = 'id';
      matchedSnippet = order.id;
      score = 100; // Perfect ID match
    } else if (rawId.includes(rawQ)) {
      matchType = 'ID';
      highlightField = 'id';
      matchedSnippet = order.id;
      score = 90;
    } else if (qDigits.length >= 2 && idDigits.includes(qDigits)) {
      matchType = 'ID';
      highlightField = 'id';
      matchedSnippet = order.id;
      score = 85;
    }

    // 2. CUSTOMER NAME MATCH (exact or partial, with or without Vietnamese diacritics)
    else if (cleanCustomerName === cleanQ || rawCustomerName === rawQ) {
      matchType = 'CUSTOMER_NAME';
      highlightField = 'customerName';
      matchedSnippet = order.customerName;
      score = 80; // Perfect customer name match
    } else if (cleanCustomerName.startsWith(cleanQ) || rawCustomerName.startsWith(rawQ)) {
      matchType = 'CUSTOMER_NAME';
      highlightField = 'customerName';
      matchedSnippet = order.customerName;
      score = 75;
    } else if (cleanCustomerName.includes(cleanQ) || rawCustomerName.includes(rawQ)) {
      matchType = 'CUSTOMER_NAME';
      highlightField = 'customerName';
      matchedSnippet = order.customerName;
      score = 70;
    }

    // 3. ADDRESS / CONDO ROOM MATCH (e.g. "B-20-10", "1501", "Sunrise", "Vinhomes", "Toà B", "Tầng 15")
    else if (
      cleanFormattedAddr.includes(cleanQ) ||
      cleanCombinedAddr.includes(cleanQ) ||
      (qDigits && (floor === qDigits || unit.includes(qDigits))) ||
      (cleanBlock && cleanQ.length <= 3 && cleanBlock === cleanQ)
    ) {
      matchType = 'ADDRESS';
      highlightField = 'address';
      matchedSnippet = formattedAddr || combinedAddrString;
      score = 60;
    }

    // 4. PHONE MATCH (e.g. "090", "0987")
    else if (rawPhone && qDigits && rawPhone.includes(qDigits)) {
      matchType = 'PHONE';
      highlightField = 'customerPhone';
      matchedSnippet = order.customerPhone || '';
      score = 50;
    }

    // 5. ITEM MATCH (e.g. "Cà phê", "Trà đào", "Bánh mì")
    else if (cleanItemsStr.includes(cleanQ)) {
      matchType = 'ITEM';
      highlightField = 'items';
      matchedSnippet = itemsStr;
      score = 40;
    }

    // 6. NOTE / INSTRUCTION MATCH
    else if (cleanNotesStr.includes(cleanQ)) {
      matchType = 'NOTE';
      highlightField = 'notes';
      matchedSnippet = notesStr;
      score = 30;
    }

    if (matchType) {
      results.push({
        order,
        matched: true,
        matchType,
        highlightField,
        matchedSnippet,
        score,
      });
    }
  }

  // Sort by score descending, then by order creation time descending
  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime();
  });
}

/**
 * Splits text into segments to highlight matching queries with diacritic support
 */
export function getHighlightedTextSegments(
  text: string,
  query: string
): { text: string; isMatch: boolean }[] {
  if (!text || !query.trim()) {
    return [{ text: text || '', isMatch: false }];
  }

  const cleanText = removeVietnameseTones(text);
  const cleanQ = removeVietnameseTones(query);

  if (!cleanQ || !cleanText.includes(cleanQ)) {
    return [{ text, isMatch: false }];
  }

  const segments: { text: string; isMatch: boolean }[] = [];
  let remainingText = text;
  let remainingClean = cleanText;

  while (remainingClean.length > 0) {
    const matchIndex = remainingClean.indexOf(cleanQ);
    if (matchIndex === -1) {
      segments.push({ text: remainingText, isMatch: false });
      break;
    }

    if (matchIndex > 0) {
      segments.push({
        text: remainingText.slice(0, matchIndex),
        isMatch: false,
      });
    }

    const matchLen = cleanQ.length;
    segments.push({
      text: remainingText.slice(matchIndex, matchIndex + matchLen),
      isMatch: true,
    });

    remainingText = remainingText.slice(matchIndex + matchLen);
    remainingClean = remainingClean.slice(matchIndex + matchLen);
  }

  return segments;
}
