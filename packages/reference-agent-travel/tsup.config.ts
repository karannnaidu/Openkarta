import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin.ts', 'src/agent.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  async onSuccess() {
    const src = resolve('src/fixtures');
    const dest = resolve('dist/fixtures');
    if (!existsSync(src)) return;
    mkdirSync(dest, { recursive: true });
    cpSync(src, dest, { recursive: true });
  },
});
