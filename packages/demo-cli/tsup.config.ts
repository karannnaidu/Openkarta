import { defineConfig } from 'tsup';
export default defineConfig({
  entry: [
    'src/cli.ts',
    'src/flows/product.ts',
    'src/flows/stay.ts',
    'src/flows/flight.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
