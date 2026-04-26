import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

export const OPENKARTA_DIR = process.env.OPENKARTA_HOME ?? join(homedir(), '.openkarta');
export const ORDERS_FILE   = join(OPENKARTA_DIR, 'orders.json');
export const STATE_FILE    = join(OPENKARTA_DIR, 'cart.json');

export async function readState(): Promise<unknown> {
  try {
    const raw = await readFile(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeState(state: unknown): Promise<void> {
  await mkdir(OPENKARTA_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export async function clearState(): Promise<void> {
  try { await writeFile(STATE_FILE, 'null', 'utf-8'); } catch { /* ignore */ }
}
