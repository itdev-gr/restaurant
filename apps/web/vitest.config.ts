import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Load env files (.env.local, .env) into process.env so tests have Supabase keys.
// Vitest does not auto-load .env.local; we mimic Next.js precedence here.
function loadEnvFiles() {
  const cwd = process.cwd();
  const files = [".env.local", ".env"]; // first wins
  const env: Record<string, string> = {};
  for (const f of files) {
    const p = resolve(cwd, f);
    if (!existsSync(p)) continue;
    const contents = readFileSync(p, "utf8");
    for (const line of contents.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in env)) env[key] = value;
    }
  }
  return env;
}

const fileEnv = loadEnvFiles();

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
    exclude: ["__tests__/e2e/**"],
    coverage: { reporter: ["text", "html"], include: ["lib/**", "server/**"] },
    env: fileEnv,
    // Tests that hit the shared Supabase dev project must run serially —
    // parallel files both wipe auth.users/public.User and would race each other.
    fileParallelism: false,
    // Supabase session-pooler adds ~150ms per query; complex tests (e.g. order creation
    // with nested items) make 8+ round-trips. Bump timeout to 20s to avoid flake.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // server-only throws in non-RSC environments; stub it for vitest.
      "server-only": fileURLToPath(new URL("./__tests__/_helpers/server-only-stub.ts", import.meta.url)),
    },
  },
});
