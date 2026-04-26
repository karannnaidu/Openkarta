import { defineConfig } from 'tsup';
export default defineConfig({
  entry: [
    'src/cli.ts',
    'src/index.ts',
    'src/run-conformance.ts',
    'src/types.ts',
    'src/runner.ts',
    'src/badge.ts',
    'src/packs/core.ts',
    'src/packs/product.ts',
    'src/packs/stay.ts',
    'src/packs/flight.ts',
    'src/packs/bus.ts',
    'src/packs/service.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
