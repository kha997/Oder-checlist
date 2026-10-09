import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from './config';
import { Order, Customer, Product, CondoLocation, StockLog } from '../types';

export interface FirebaseSyncCallbacks {
  onOrdersChange?: (orders: Order[]) => void;
  onCustomersChange?: (customers: Customer[]) => void;
  onProductsChange?: (products: Product[]) => void;
  onCondosChange?: (condos: CondoLocation[]) => void;
  onStockLogsChange?: (stockLogs: StockLog[]) => void;
  onError?: (error: unknown) => void;
}

// Clean object helper to strip undefined fields before Firestore write
function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = sanitizeForFirestore(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Subscribes to all real-time Firestore collections.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToFirebaseCollections(callbacks: FirebaseSyncCallbacks): () => void {
  const unsubscribers: Unsubscribe[] = [];

  // 1. Orders
  try {
    const ordersCol = collection(db, 'orders');
    const unsubOrders = onSnapshot(
      ordersCol,
      (snapshot) => {
        const items: Order[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as Order);
        });
        callbacks.onOrdersChange?.(items);
      },
      (error) => {
        callbacks.onError?.(error);
        handleFirestoreError(error, OperationType.GET, 'orders');
      }
    );
    unsubscribers.push(unsubOrders);
  } catch (err) {
    callbacks.onError?.(err);
  }

  // 2. Customers
  try {
    const custCol = collection(db, 'customers');
    const unsubCust = onSnapshot(
      custCol,
      (snapshot) => {
        const items: Customer[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as Customer);
        });
        callbacks.onCustomersChange?.(items);
      },
      (error) => {
        callbacks.onError?.(error);
        handleFirestoreError(error, OperationType.GET, 'customers');
      }
    );
    unsubscribers.push(unsubCust);
  } catch (err) {
    callbacks.onError?.(err);
  }

  // 3. Products
  try {
    const prodCol = collection(db, 'products');
    const unsubProd = onSnapshot(
      prodCol,
      (snapshot) => {
        const items: Product[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as Product);
        });
        callbacks.onProductsChange?.(items);
      },
      (error) => {
        callbacks.onError?.(error);
        handleFirestoreError(error, OperationType.GET, 'products');
      }
    );
    unsubscribers.push(unsubProd);
  } catch (err) {
    callbacks.onError?.(err);
  }

  // 4. Condos
  try {
    const condosCol = collection(db, 'condos');
    const unsubCondos = onSnapshot(
      condosCol,
      (snapshot) => {
        const items: CondoLocation[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as CondoLocation);
        });
        callbacks.onCondosChange?.(items);
      },
      (error) => {
        callbacks.onError?.(error);
        handleFirestoreError(error, OperationType.GET, 'condos');
      }
    );
    unsubscribers.push(unsubCondos);
  } catch (err) {
    callbacks.onError?.(err);
  }

  // 5. Stock Logs
  try {
    const logsCol = collection(db, 'stockLogs');
    const unsubLogs = onSnapshot(
      logsCol,
      (snapshot) => {
        const items: StockLog[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as StockLog);
        });
        callbacks.onStockLogsChange?.(items);
      },
      (error) => {
        callbacks.onError?.(error);
        handleFirestoreError(error, OperationType.GET, 'stockLogs');
      }
    );
    unsubscribers.push(unsubLogs);
  } catch (err) {
    callbacks.onError?.(err);
  }

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

// ----------------- Write Operations -----------------

export async function upsertOrderFirestore(order: Order): Promise<void> {
  const path = `orders/${order.id}`;
  try {
    const docRef = doc(db, 'orders', order.id);
    await setDoc(docRef, sanitizeForFirestore(order), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateOrderFirestore(orderId: string, updates: Partial<Order>): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    const docRef = doc(db, 'orders', orderId);
    await updateDoc(docRef, sanitizeForFirestore(updates));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteOrderFirestore(orderId: string): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    const docRef = doc(db, 'orders', orderId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertCustomerFirestore(customer: Customer): Promise<void> {
  const path = `customers/${customer.id}`;
  try {
    const docRef = doc(db, 'customers', customer.id);
    await setDoc(docRef, sanitizeForFirestore(customer), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertProductFirestore(product: Product): Promise<void> {
  const path = `products/${product.id}`;
  try {
    const docRef = doc(db, 'products', product.id);
    await setDoc(docRef, sanitizeForFirestore(product), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertCondoFirestore(condo: CondoLocation): Promise<void> {
  const path = `condos/${condo.id}`;
  try {
    const docRef = doc(db, 'condos', condo.id);
    await setDoc(docRef, sanitizeForFirestore(condo), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function addStockLogFirestore(log: StockLog): Promise<void> {
  const path = `stockLogs/${log.id}`;
  try {
    const docRef = doc(db, 'stockLogs', log.id);
    await setDoc(docRef, sanitizeForFirestore(log), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Checks if Firestore collections are empty and optionally seeds current local dataset
 */
export async function seedLocalDataToFirestoreIfEmpty(data: {
  orders: Order[];
  customers: Customer[];
  products: Product[];
  condos: CondoLocation[];
  stockLogs: StockLog[];
}): Promise<void> {
  try {
    const ordersSnap = await getDocs(collection(db, 'orders'));
    if (ordersSnap.empty && data.orders.length > 0) {
      console.log('Seeding initial orders to Firestore...');
      for (const ord of data.orders) {
        await upsertOrderFirestore(ord);
      }
    }

    const custSnap = await getDocs(collection(db, 'customers'));
    if (custSnap.empty && data.customers.length > 0) {
      console.log('Seeding initial customers to Firestore...');
      for (const c of data.customers) {
        await upsertCustomerFirestore(c);
      }
    }

    const prodSnap = await getDocs(collection(db, 'products'));
    if (prodSnap.empty && data.products.length > 0) {
      console.log('Seeding initial products to Firestore...');
      for (const p of data.products) {
        await upsertProductFirestore(p);
      }
    }

    const condoSnap = await getDocs(collection(db, 'condos'));
    if (condoSnap.empty && data.condos.length > 0) {
      console.log('Seeding initial condos to Firestore...');
      for (const c of data.condos) {
        await upsertCondoFirestore(c);
      }
    }

    const logsSnap = await getDocs(collection(db, 'stockLogs'));
    if (logsSnap.empty && data.stockLogs.length > 0) {
      console.log('Seeding initial stock logs to Firestore...');
      for (const l of data.stockLogs) {
        await addStockLogFirestore(l);
      }
    }
  } catch (err) {
    console.warn('Initial seeding check skipped or deferred:', err);
  }
}
