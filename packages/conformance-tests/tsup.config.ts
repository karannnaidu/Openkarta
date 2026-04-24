import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/cli.ts', 'src/types.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
