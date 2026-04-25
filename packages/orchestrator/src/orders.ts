import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type { OrderRecord } from './types.js';

export interface OrderStoreOptions { ordersFile?: string; }
export interface OrderStore {
  add(record: OrderRecord): Promise<void>;
  list(): Promise<OrderRecord[]>;
  find(orderId: string): Promise<OrderRecord | undefined>;
}

const DEFAULT_PATH = join(homedir(), '.openkarta', 'orders.json');

export function createOrderStore(opts: OrderStoreOptions = {}): OrderStore {
  const file = opts.ordersFile ?? DEFAULT_PATH;

  async function readAll(): Promise<OrderRecord[]> {
    try {
      const raw = await readFile(file, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return [];
      const orders = (parsed as { orders?: unknown }).orders;
      return Array.isArray(orders) ? (orders as OrderRecord[]) : [];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  async function writeAll(records: OrderRecord[]): Promise<void> {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ version: 1, orders: records }, null, 2), 'utf-8');
  }

  return {
    async add(record) {
      const all = await readAll();
      all.push(record);
      await writeAll(all);
    },
    list: () => readAll(),
    async find(orderId) {
      const all = await readAll();
      return all.find((o) => o.orderId === orderId);
    },
  };
}
