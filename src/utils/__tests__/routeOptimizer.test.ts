import { describe, expect, it } from 'vitest';
import { type LocationType, type Order } from '../../types';
import {
  calculateRouteMetrics,
  extractBlockName,
  extractFloorNumber,
  optimizeByElevatorTopDown,
  optimizeByPriorityAndDue,
} from '../routeOptimizer';

function makeOrder(
  id: string,
  location: {
    type: LocationType;
    block?: string;
    floor?: string;
    unit?: string;
    formattedAddress: string;
  },
  overrides: Partial<Order> = {}
): Order {
  return {
    id,
    createdAt: '2026-10-11T08:00:00.000Z',
    customerName: `Customer ${id}`,
    items: [],
    totalAmount: 100000,
    location,
    deliveryStatus: 'PENDING',
    paymentStatus: 'UNPAID',
    status: 'ACTIVE',
    ...overrides,
  };
}

const condo = (id: string, block: string, floor: string, unit = '01') =>
  makeOrder(id, {
    type: 'condo',
    block,
    floor,
    unit,
    formattedAddress: `${block}-${floor}-${unit}`,
  });

const external = (id: string) =>
  makeOrder(id, { type: 'external', formattedAddress: '128 Nguyễn Trãi' });

describe('extractFloorNumber', () => {
  it('reads the floor from location.floor when present', () => {
    expect(extractFloorNumber(condo('O1', 'B', '20'))).toBe(20);
    expect(extractFloorNumber(condo('O2', 'A', '3'))).toBe(3);
  });

  it('falls back to parsing the formatted address', () => {
    const order = makeOrder('O3', {
      type: 'condo',
      formattedAddress: 'B-20-10',
    });
    expect(extractFloorNumber(order)).toBe(20);
  });

  it('parses a bare numeric address but only for plausible floors', () => {
    expect(
      extractFloorNumber(makeOrder('O4', { type: 'condo', formattedAddress: '15' }))
    ).toBe(15);
    // 9999 is not a floor number, it is an id-like digit run
    expect(
      extractFloorNumber(makeOrder('O5', { type: 'condo', formattedAddress: '9999' }))
    ).toBe(0);
  });

  it('returns 0 for external deliveries', () => {
    expect(extractFloorNumber(external('O6'))).toBe(0);
  });

  it('returns 0 when nothing can be parsed', () => {
    expect(
      extractFloorNumber(makeOrder('O7', { type: 'condo', formattedAddress: 'khong co' }))
    ).toBe(0);
  });
});

describe('extractBlockName', () => {
  it('upper-cases an explicit block', () => {
    expect(extractBlockName(makeOrder('O1', { type: 'condo', block: 'b', formattedAddress: 'B-1-1' }))).toBe('B');
  });

  it('parses the block prefix from the formatted address', () => {
    expect(extractBlockName(makeOrder('O2', { type: 'condo', formattedAddress: 'C-10-05' }))).toBe('C');
  });

  it('defaults to block A when nothing is set', () => {
    expect(extractBlockName(makeOrder('O3', { type: 'condo', formattedAddress: '10' }))).toBe('A');
  });

  it('tags external deliveries separately', () => {
    expect(extractBlockName(external('O4'))).toBe('EXTERNAL');
  });
});

describe('optimizeByElevatorTopDown', () => {
  it('does not mutate its input', () => {
    const input = [condo('O1', 'B', '5'), condo('O2', 'A', '1')];
    const snapshot = input.map((o) => o.id);
    optimizeByElevatorTopDown(input);
    expect(input.map((o) => o.id)).toEqual(snapshot);
  });

  it('groups by block, then orders highest floor first', () => {
    const sorted = optimizeByElevatorTopDown([
      condo('B-05', 'B', '5'),
      condo('A-15', 'A', '15'),
      condo('B-20', 'B', '20'),
    ]);
    expect(sorted.map((o) => o.id)).toEqual(['A-15', 'B-20', 'B-05']);
  });

  it('sends external deliveries to the end of the route', () => {
    const sorted = optimizeByElevatorTopDown([external('EXT'), condo('A-1', 'A', '1')]);
    expect(sorted.map((o) => o.id)).toEqual(['A-1', 'EXT']);
  });
});

describe('optimizeByPriorityAndDue', () => {
  it('puts HIGH priority orders ahead of lower priority ones', () => {
    const sorted = optimizeByPriorityAndDue([
      { ...condo('LOW', 'A', '30', '01'), priority: 'LOW' as const },
      { ...condo('HIGH', 'A', '1', '01'), priority: 'HIGH' as const },
      { ...condo('MED', 'A', '20', '01'), priority: 'MEDIUM' as const },
    ]);
    const ids = sorted.map((o) => o.id);
    expect(ids.indexOf('HIGH')).toBeLessThan(ids.indexOf('MED'));
    expect(ids.indexOf('MED')).toBeLessThan(ids.indexOf('LOW'));
  });

  it('falls back to highest-floor-first when priorities tie', () => {
    const sorted = optimizeByPriorityAndDue([
      condo('F10', 'A', '10', '01'),
      condo('F30', 'A', '30', '01'),
      condo('F20', 'A', '20', '01'),
    ]);
    expect(sorted.map((o) => o.id)).toEqual(['F30', 'F20', 'F10']);
  });
});

describe('calculateRouteMetrics', () => {
  it('returns a zeroed, 100-score report for an empty route', () => {
    expect(calculateRouteMetrics([])).toEqual({
      totalStops: 0,
      completedStops: 0,
      pendingStops: 0,
      totalFloorsTraversed: 0,
      upwardElevatorBacktracks: 0,
      estimatedMinutes: 0,
      efficiencyScore: 100,
      totalAmount: 0,
      unpaidAmount: 0,
    });
  });

  it('counts stops, revenue and unpaid balance', () => {
    const metrics = calculateRouteMetrics([
      condo('O1', 'B', '5'),
      makeOrder('O2', { type: 'condo', block: 'B', floor: '1', formattedAddress: 'B-1-1' }, {
        deliveryStatus: 'DELIVERED',
        paymentStatus: 'PAID',
        totalAmount: 250000,
      }),
    ]);
    expect(metrics.totalStops).toBe(2);
    expect(metrics.completedStops).toBe(1);
    expect(metrics.pendingStops).toBe(1);
    expect(metrics.totalAmount).toBe(350000);
    expect(metrics.unpaidAmount).toBe(100000);
  });

  it('penalises elevator backtracks when the route goes back up', () => {
    const downward = calculateRouteMetrics([condo('O1', 'B', '20'), condo('O2', 'B', '5')]);
    expect(downward.totalFloorsTraversed).toBe(15);
    expect(downward.upwardElevatorBacktracks).toBe(0);

    const upward = calculateRouteMetrics([condo('O1', 'B', '5'), condo('O2', 'B', '20')]);
    expect(upward.upwardElevatorBacktracks).toBe(1);
    expect(upward.efficiencyScore).toBe(92);
    expect(upward.efficiencyScore).toBeLessThan(downward.efficiencyScore);
  });

  it('never reports an efficiency score below the 45 floor or above 100', () => {
    const manyBacktracks = Array.from({ length: 6 }, (_, i) =>
      condo(`O${i}`, 'B', String(1 + i * 5))
    );
    const { efficiencyScore, estimatedMinutes } = calculateRouteMetrics(manyBacktracks);
    expect(efficiencyScore).toBeGreaterThanOrEqual(45);
    expect(efficiencyScore).toBeLessThanOrEqual(100);
    expect(estimatedMinutes).toBeGreaterThanOrEqual(5);
  });
});
