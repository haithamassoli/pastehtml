import { defineConfig } from "vitest/config";

// ponytail: node env + edge-runtime handled per-file; add jsdom + @vitejs/plugin-react when we test components.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
    // Placeholders so `lib/env.ts` validation passes; tests never call out.
    env: {
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_CONVEX_URL: "https://test-placeholder.convex.cloud",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_placeholder",
    },
  },
  resolve: {
    alias: { "@": new URL(".", import.meta.url).pathname },
  },
});
