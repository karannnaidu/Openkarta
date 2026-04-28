import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts", "src/bin.ts", "src/bootstrap.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: "node22",
  banner: { js: "#!/usr/bin/env node" },
});
