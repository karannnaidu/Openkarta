import { bootstrap } from "./bootstrap.js";

bootstrap({ transport: "stdio" }).catch((err) => {
  process.stderr.write(
    `@openkarta/mcp-bridge failed to start: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
