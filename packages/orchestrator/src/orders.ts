import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import type { OrderRecord } from './types.js';

export interface OrderStoreOptions { ordersFile?: string; }
export interface OrderStore {
  add(record: OrderRecord): Promise<void>;
  list(): Promise<OrderRecord[]>;
  find(orderId: string): Promise<OrderRecord | undefined>;
}

const DEFAULT_PATH = `${homedir()}/.openkarta/orders.json`;

export function createOrderStore(opts: OrderStoreOptions = {}): OrderStore {
  const file = opts.ordersFile ?? DEFAULT_PATH;

  async function readAll(): Promise<OrderRecord[]> {
    try {
      const raw = await readFile(file, 'utf-8');
      const parsed = JSON.parse(raw) as { orders?: OrderRecord[] };
      return Array.isArray(parsed.orders) ? parsed.orders : [];
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
