import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/bin.ts', 'src/agent.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
