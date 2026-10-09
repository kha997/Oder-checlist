import { Order } from '../types';

/**
 * Extracts numeric floor from condo location or address string (e.g. "B-20-10" -> 20)
 */
export function extractFloorNumber(order: Order): number {
  if (order.location.type === 'external') {
    return 0;
  }
  if (order.location.floor) {
    const parsed = parseInt(order.location.floor, 10);
    if (!isNaN(parsed)) return parsed;
  }
  // Try parsing from formattedAddress (e.g., "B-20-10" or "A-15-02" or "20-10")
  const addr = order.location.formattedAddress || '';
  const match = addr.match(/[A-Za-z0-9]+-(\d+)-/);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) return num;
  }
  const simpleMatch = addr.match(/(\d+)/);
  if (simpleMatch && simpleMatch[1]) {
    const num = parseInt(simpleMatch[1], 10);
    if (!isNaN(num) && num < 60) return num;
  }
  return 0;
}

/**
 * Extracts block letter or name (e.g. "B" from "B-20-10")
 */
export function extractBlockName(order: Order): string {
  if (order.location.type === 'external') {
    return 'EXTERNAL';
  }
  if (order.location.block) {
    return order.location.block.toUpperCase();
  }
  const addr = order.location.formattedAddress || '';
  const match = addr.match(/^([A-Za-z0-9]+)-/);
  if (match && match[1]) {
    return match[1].toUpperCase();
  }
  return 'A';
}

export interface RouteMetrics {
  totalStops: number;
  completedStops: number;
  pendingStops: number;
  totalFloorsTraversed: number;
  upwardElevatorBacktracks: number; // Number of times elevator had to go up again
  estimatedMinutes: number;
  efficiencyScore: number; // 0 - 100%
  totalAmount: number;
  unpaidAmount: number;
}

/**
 * Analyzes sequence of orders and calculates route metrics
 */
export function calculateRouteMetrics(sequence: Order[]): RouteMetrics {
  const totalStops = sequence.length;
  if (totalStops === 0) {
    return {
      totalStops: 0,
      completedStops: 0,
      pendingStops: 0,
      totalFloorsTraversed: 0,
      upwardElevatorBacktracks: 0,
      estimatedMinutes: 0,
      efficiencyScore: 100,
      totalAmount: 0,
      unpaidAmount: 0,
    };
  }

  let completedStops = 0;
  let totalAmount = 0;
  let unpaidAmount = 0;
  let totalFloorsTraversed = 0;
  let upwardElevatorBacktracks = 0;

  sequence.forEach((ord) => {
    if (ord.deliveryStatus === 'DELIVERED') completedStops++;
    totalAmount += ord.totalAmount;
    if (ord.paymentStatus === 'UNPAID') unpaidAmount += ord.totalAmount;
  });

  const pendingStops = totalStops - completedStops;

  // Calculate floor elevation travel
  let prevFloor: number | null = null;
  let prevBlock: string | null = null;
  let blockSwitches = 0;

  for (let i = 0; i < sequence.length; i++) {
    const curFloor = extractFloorNumber(sequence[i]);
    const curBlock = extractBlockName(sequence[i]);

    if (prevFloor !== null) {
      const diff = Math.abs(curFloor - prevFloor);
      totalFloorsTraversed += diff;

      // In condo delivery, if we are in the same block and floor went UP, that's an elevator backtrack
      if (prevBlock === curBlock && curBlock !== 'EXTERNAL' && curFloor > prevFloor) {
        upwardElevatorBacktracks++;
      }
      if (prevBlock !== curBlock) {
        blockSwitches++;
      }
    }

    prevFloor = curFloor;
    prevBlock = curBlock;
  }

  // Estimated delivery duration:
  // Base 3 minutes per stop + 0.3 min per floor change + 5 min per block transfer + 8 min for external
  const transitTime =
    totalStops * 3 +
    Math.round(totalFloorsTraversed * 0.3) +
    blockSwitches * 4 +
    sequence.filter((o) => o.location.type === 'external').length * 5;

  // Efficiency score: penalize upward elevator backtracks and excessive block hops
  const backtrackPenalty = upwardElevatorBacktracks * 8;
  const blockHopPenalty = Math.max(0, blockSwitches - 2) * 5;
  const rawScore = 100 - backtrackPenalty - blockHopPenalty;
  const efficiencyScore = Math.max(45, Math.min(100, rawScore));

  return {
    totalStops,
    completedStops,
    pendingStops,
    totalFloorsTraversed,
    upwardElevatorBacktracks,
    estimatedMinutes: Math.max(5, transitTime),
    efficiencyScore,
    totalAmount,
    unpaidAmount,
  };
}

/**
 * Sorts orders from highest floor to lowest floor (Elevator top-down optimization)
 */
export function optimizeByElevatorTopDown(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    // Condo first, then external
    if (a.location.type === 'condo' && b.location.type === 'external') return -1;
    if (a.location.type === 'external' && b.location.type === 'condo') return 1;

    // Same block grouping preference
    const blockA = extractBlockName(a);
    const blockB = extractBlockName(b);
    if (blockA !== blockB) {
      return blockA.localeCompare(blockB);
    }

    // Highest floor to lowest floor
    const floorA = extractFloorNumber(a);
    const floorB = extractFloorNumber(b);
    if (floorA !== floorB) {
      return floorB - floorA;
    }

    // Secondary: unit
    const unitA = parseInt(a.location.unit || '0', 10);
    const unitB = parseInt(b.location.unit || '0', 10);
    return unitA - unitB;
  });
}

/**
 * Cluster orders by Block first, then highest floor down
 */
export function optimizeByBlockCluster(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    if (a.location.type === 'condo' && b.location.type === 'external') return -1;
    if (a.location.type === 'external' && b.location.type === 'condo') return 1;

    const blockA = extractBlockName(a);
    const blockB = extractBlockName(b);
    if (blockA !== blockB) {
      return blockA.localeCompare(blockB);
    }

    const floorA = extractFloorNumber(a);
    const floorB = extractFloorNumber(b);
    return floorB - floorA;
  });
}

/**
 * Prioritize HIGH priority orders and orders due soon, then by highest floor
 */
export function optimizeByPriorityAndDue(orders: Order[]): Order[] {
  const getPriorityWeight = (o: Order) => {
    if (o.priority === 'HIGH') return 3;
    if (o.priority === 'MEDIUM') return 2;
    return 1;
  };

  return [...orders].sort((a, b) => {
    const pA = getPriorityWeight(a);
    const pB = getPriorityWeight(b);
    if (pA !== pB) {
      return pB - pA; // Higher weight first
    }

    // Then by floor highest to lowest
    const floorA = extractFloorNumber(a);
    const floorB = extractFloorNumber(b);
    return floorB - floorA;
  });
}
