import { defineConfig } from "vitest/config";

// ponytail: node env + edge-runtime handled per-file; add jsdom + @vitejs/plugin-react when we test components.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
  },
  resolve: {
    alias: { "@": new URL(".", import.meta.url).pathname },
  },
});
