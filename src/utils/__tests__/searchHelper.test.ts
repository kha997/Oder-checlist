import { describe, expect, it } from 'vitest';
import { type Order } from '../../types';
import { removeVietnameseTones, searchOrders } from '../searchHelper';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ORD-1001',
    createdAt: '2026-10-11T08:00:00.000Z',
    customerName: 'Nguyễn Thị Hoa',
    customerPhone: '0901 234 567',
    items: [
      {
        productId: 'p1',
        productName: 'Cà phê sữa',
        quantity: 2,
        unitPrice: 25000,
        lineTotal: 50000,
        unit: 'ly',
      },
    ],
    totalAmount: 150000,
    location: {
      type: 'condo',
      condoName: 'Sunrise City',
      block: 'B',
      floor: '20',
      unit: '10',
      formattedAddress: 'B-20-10',
    },
    deliveryStatus: 'PENDING',
    paymentStatus: 'UNPAID',
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('removeVietnameseTones', () => {
  it('strips diacritics from accented vowels', () => {
    expect(removeVietnameseTones('Hương')).toBe('huong');
    expect(removeVietnameseTones('Tuấn')).toBe('tuan');
  });

  it('converts the stroke letter đ to d', () => {
    expect(removeVietnameseTones('Đà Nẵng')).toBe('da nang');
    expect(removeVietnameseTones('đường')).toBe('duong');
  });

  it('lowercases and trims surrounding whitespace', () => {
    expect(removeVietnameseTones('  NGUYỄN  ')).toBe('nguyen');
  });

  it('returns an empty string for falsy input', () => {
    expect(removeVietnameseTones('')).toBe('');
    expect(removeVietnameseTones(undefined as unknown as string)).toBe('');
  });

  it('is idempotent', () => {
    expect(removeVietnameseTones(removeVietnameseTones('Phở Bò'))).toBe('pho bo');
  });
});

describe('searchOrders', () => {
  const orders = [
    makeOrder(),
    makeOrder({
      id: 'ORD-1002',
      customerName: 'Trần Văn Tuấn',
      status: 'CANCELLED',
    }),
    makeOrder({
      id: 'ORD-2005',
      customerName: 'Lê Minh',
      customerPhone: '0987654321',
      items: [
        {
          productId: 'p2',
          productName: 'Trà đào',
          quantity: 1,
          unitPrice: 30000,
          lineTotal: 30000,
          unit: 'ly',
        },
      ],
      location: { type: 'external', formattedAddress: '128 Nguyễn Trãi' },
    }),
  ];

  it('returns nothing for an empty or whitespace query', () => {
    expect(searchOrders(orders, '')).toEqual([]);
    expect(searchOrders(orders, '   ')).toEqual([]);
  });

  it('matches by exact order ID and ranks it first', () => {
    const results = searchOrders(orders, 'ORD-1001');
    expect(results).toHaveLength(1);
    expect(results[0].matched).toBe(true);
    expect(results[0].matchType).toBe('ID');
    expect(results[0].highlightField).toBe('id');
    expect(results[0].score).toBe(100);
    expect(results[0].order.id).toBe('ORD-1001');
  });

  it('matches an order by numeric substring', () => {
    const results = searchOrders(orders, '2005');
    expect(results.map((r) => r.order.id)).toContain('ORD-2005');
    expect(results[0].matchType).toBe('ID');
  });

  it('matches customer names regardless of Vietnamese accents', () => {
    const noAccents = searchOrders(orders, 'nguyen thi hoa');
    expect(noAccents).toHaveLength(1);
    expect(noAccents[0].matchType).toBe('CUSTOMER_NAME');
    expect(noAccents[0].score).toBe(80);

    const withAccents = searchOrders(orders, 'Nguyễn Thị Hoa');
    expect(withAccents[0].order.id).toBe('ORD-1001');
  });

  it('skips cancelled orders', () => {
    const results = searchOrders(orders, 'Trần Văn Tuấn');
    expect(results).toHaveLength(0);
  });

  it('matches condo room numbers through the address branch', () => {
    const results = searchOrders(orders, 'B-20-10');
    expect(results[0].matchType).toBe('ADDRESS');
    expect(results[0].highlightField).toBe('address');
  });

  it('matches Vietnamese item names without accents', () => {
    const results = searchOrders(orders, 'ca phe');
    expect(results).toHaveLength(1);
    expect(results[0].matchType).toBe('ITEM');
    expect(results[0].highlightField).toBe('items');
  });

  it('matches phone numbers by digit substring', () => {
    const results = searchOrders(orders, '0901');
    expect(results.map((r) => r.order.id)).toContain('ORD-1001');
  });

  it('returns nothing when nothing matches', () => {
    expect(searchOrders(orders, 'zzz-khong-ton-tai')).toEqual([]);
  });
});
