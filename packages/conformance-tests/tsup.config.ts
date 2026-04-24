import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/cli.ts', 'src/types.ts', 'src/packs/core.ts', 'src/packs/product.ts', 'src/packs/stay.ts', 'src/packs/flight.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
