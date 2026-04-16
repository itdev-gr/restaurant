# Restaurant Platform — Phase 1A: Foundation, Auth, Multi-Tenancy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the monorepo, set up Next.js 14 + Prisma against a single Supabase Cloud project (no Docker), implement owner email/password signup and login backed by Supabase Auth, capture restaurant onboarding, deploy to Vercel against the same Supabase project. Output: an owner can register, log in, create a restaurant, and land on a working admin shell.

**Architecture:** pnpm monorepo with `apps/web` (Next.js 14 App Router) + `packages/db` (Prisma client + schema) + `packages/shared` (zod schemas + types) + `packages/config` (lint/tsconfig presets). Identity is owned by Supabase Auth (email + password). Each Supabase user is mirrored into `public.User` (same UUID as `auth.users.id`) by the signup server action. `Membership` rows link users to restaurants with a role. Sessions are stored as cookies via `@supabase/ssr`; Next.js middleware refreshes tokens on every request and redirects unauthenticated users from protected routes. The active restaurant is resolved server-side from the user's primary membership (Phase 1B will additionally pin `restaurantId` into Supabase `app_metadata` so RLS policies can read it from `auth.jwt()`).

**Tech Stack:** Next.js 14 (App Router, RSC), TypeScript (strict), Tailwind CSS + shadcn/ui, Prisma + Postgres (Supabase Cloud), `@supabase/supabase-js` + `@supabase/ssr`, Zod, react-hook-form, Vitest (unit/integration), Playwright (e2e), pnpm workspaces (via `corepack`), GitHub Actions, Vercel + Supabase Cloud (EU/Frankfurt — single project `restaurant`).

**Local dev approach:** No Docker, single Supabase Cloud project (`restaurant`) shared by local dev and the deployed Vercel app. Email-confirmation behavior is split via the `SUPABASE_AUTO_CONFIRM` env var: `true` in `.env.local` (dev signups skip the email step), unset in Vercel (prod signups must confirm via email). Tradeoffs: ~150ms query latency, dev test data lives alongside real data — use throwaway emails for testing and clean them up periodically via the Supabase dashboard.

---

## File Structure (Phase 1A scope)

```
restaurant/
├── package.json                                # root: scripts, devDeps
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── .nvmrc                                      # node 20
├── .editorconfig
├── .github/workflows/ci.yml
├── packages/
│   ├── config/
│   │   ├── package.json
│   │   ├── eslint.config.mjs
│   │   ├── prettier.config.mjs
│   │   └── tsconfig.base.json
│   ├── db/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/schema.prisma
│   │   ├── prisma/migrations/                  # generated
│   │   ├── src/index.ts                        # exports prisma client
│   │   └── src/seed.ts
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           └── zod/
│               ├── auth.ts
│               └── restaurant.ts
└── apps/web/
    ├── package.json
    ├── next.config.mjs
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── postcss.config.mjs
    ├── vitest.config.ts
    ├── playwright.config.ts
    ├── .env.example
    ├── middleware.ts                           # supabase session refresh + auth gate
    ├── app/
    │   ├── layout.tsx                          # root layout, fonts
    │   ├── page.tsx                            # marketing landing (placeholder)
    │   ├── globals.css                         # tailwind base
    │   ├── (auth)/
    │   │   ├── layout.tsx                      # centered card layout
    │   │   ├── signup/page.tsx
    │   │   └── login/page.tsx
    │   └── (admin)/
    │       ├── layout.tsx                      # sidebar shell, requires session
    │       ├── onboarding/page.tsx             # create-first-restaurant wizard
    │       └── dashboard/page.tsx              # placeholder dashboard
    ├── lib/
    │   ├── db.ts                               # re-exports prisma from @app/db
    │   ├── supabase-browser.ts                 # createBrowserClient()
    │   ├── supabase-server.ts                  # createServerClient() w/ cookies
    │   ├── supabase-admin.ts                   # service-role client (server-only)
    │   ├── supabase-middleware.ts              # updateSession() helper for middleware
    │   ├── auth-helpers.ts                     # getSession(), requireSession(), requireRestaurant()
    │   ├── slug.ts                             # generateUniqueSlug()
    │   └── tenant.ts                           # currentRestaurantId(), currentMembership()
    ├── server/
    │   └── actions/
    │       ├── auth.ts                         # signupAction (admin createUser + mirror)
    │       └── restaurant.ts                   # createRestaurantAction
    ├── components/
    │   ├── ui/                                 # shadcn primitives (button, input, card, label)
    │   ├── auth/
    │   │   ├── signup-form.tsx
    │   │   └── login-form.tsx
    │   └── admin/
    │       ├── sidebar.tsx
    │       ├── topbar.tsx
    │       └── onboarding-form.tsx
    └── __tests__/
        ├── lib/slug.test.ts
        ├── lib/tenant.test.ts
        ├── server/actions/auth.test.ts
        ├── server/actions/restaurant.test.ts
        ├── _helpers/db.ts
        └── e2e/
            ├── signup.spec.ts
            ├── login.spec.ts
            └── onboarding.spec.ts
```

**Boundaries:**

- `packages/db`: owns the Prisma schema and exports a singleton `prisma` client.
- `packages/shared`: pure types and zod schemas — no runtime Next.js or DB deps.
- `apps/web/lib`: framework-aware helpers; one responsibility per file.
- `apps/web/server/actions`: server actions write via Prisma + Supabase admin, validate with zod, return discriminated-union results — never throw.

---

## Conventions

- Use `pnpm` for all package operations.
- ESM throughout (`"type": "module"`, `.mjs` for configs).
- Path aliases: `@app/*` (cross-package workspace), `@/*` (apps/web internal).
- Money in integer cents.
- Times are UTC `DateTime`.
- Server actions return `{ ok: true, data } | { ok: false, error: { code, message, fields? } }`.
- Run `lint` + `typecheck` + `test` before every commit.
- Conventional Commits.

---

## Tasks

### Task 1: Initialize pnpm monorepo skeleton

**Files:**

- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.nvmrc`, `.editorconfig`, `README.md`

- [ ] **Step 1: Enable pnpm via corepack and initialize git**

```bash
cd /Users/marios/Desktop/Cursor/restaurant
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm --version   # should print 9.12.0
git init
```

- [ ] **Step 2: Write `.nvmrc`**

```
20
```

- [ ] **Step 3: Write `.gitignore`**

```
node_modules
.next
.turbo
dist
build
out
.env
.env.local
.env.*.local
.DS_Store
*.log
coverage
playwright-report
test-results
```

- [ ] **Step 4: Write `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

- [ ] **Step 5: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 6: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "jsx": "preserve",
    "incremental": true
  }
}
```

- [ ] **Step 7: Write root `package.json`**

```json
{
  "name": "restaurant-platform",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20.10.0" },
  "scripts": {
    "dev": "pnpm -F @app/web dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "test:e2e": "pnpm -F @app/web test:e2e",
    "db:generate": "pnpm -F @app/db generate",
    "db:migrate": "pnpm -F @app/db migrate",
    "db:seed": "pnpm -F @app/db seed",
    "db:studio": "pnpm -F @app/db studio",
    "format": "prettier -w ."
  },
  "devDependencies": {
    "prettier": "^3.3.3",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 8: Write `README.md`**

````markdown
# Restaurant Platform

Multi-tenant SaaS for QR-code dine-in ordering. See `docs/superpowers/specs/2026-04-16-restaurant-ordering-platform-design.md` for architecture.

## Quickstart

```bash
corepack enable && corepack prepare pnpm@9.12.0 --activate
pnpm install
# Set DATABASE_URL/DIRECT_URL/NEXT_PUBLIC_SUPABASE_* in .env files (see .env.example)
pnpm db:migrate
pnpm db:seed
pnpm dev
```
````

App at http://localhost:3000. Studio: https://supabase.com (your `restaurant-dev` project → Table Editor).

````

- [ ] **Step 9: Install root deps**

Run: `pnpm install`
Expected: lockfile generated.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: initialize pnpm monorepo skeleton"
````

---

### Task 2: Set up shared lint/format/tsconfig package

**Files:**

- Create: `packages/config/package.json`
- Create: `packages/config/eslint.config.mjs`
- Create: `packages/config/prettier.config.mjs`
- Create: `packages/config/tsconfig.base.json`
- Create: `prettier.config.mjs` (root re-export)

- [ ] **Step 1: Create `packages/config/package.json`**

```json
{
  "name": "@app/config",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./eslint.config.mjs",
  "exports": {
    "./eslint": "./eslint.config.mjs",
    "./prettier": "./prettier.config.mjs",
    "./tsconfig": "./tsconfig.base.json"
  },
  "devDependencies": {
    "@eslint/js": "^9.13.0",
    "eslint": "^9.13.0",
    "eslint-config-next": "^14.2.15",
    "eslint-plugin-import": "^2.31.0",
    "typescript-eslint": "^8.11.0"
  }
}
```

- [ ] **Step 2: Create `packages/config/eslint.config.mjs`**

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-floating-promises": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "dangerouslySetInnerHTML is forbidden — use safe rendering.",
        },
      ],
    },
  },
  { ignores: ["**/.next/**", "**/dist/**", "**/node_modules/**", "**/coverage/**"] },
);
```

- [ ] **Step 3: Create `packages/config/prettier.config.mjs`**

```js
export default {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  arrowParens: "always",
  plugins: ["prettier-plugin-tailwindcss"],
};
```

- [ ] **Step 4: Create `packages/config/tsconfig.base.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "composite": false, "noEmit": true }
}
```

- [ ] **Step 5: Create root `prettier.config.mjs`**

```js
export { default } from "./packages/config/prettier.config.mjs";
```

- [ ] **Step 6: Install prettier plugin at root**

Run: `pnpm add -Dw prettier-plugin-tailwindcss`

- [ ] **Step 7: Install workspace deps**

Run: `pnpm install`
Expected: `@app/config` linked.

- [ ] **Step 8: Verify prettier runs**

Run: `pnpm format`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: add shared eslint/prettier/tsconfig package"
```

---

### Task 3: Create Supabase Cloud dev project and Prisma in `packages/db`

**Files:**

- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/prisma/schema.prisma`, `packages/db/src/index.ts`, `packages/db/src/seed.ts`, `packages/db/.env.example`

**Manual prerequisite (user does this in browser, ~2 min):**

1. Sign in at https://supabase.com (free, no credit card required)
2. New project: name `restaurant`, region **EU Central (Frankfurt)**, generate a strong DB password and save it
3. Wait ~1 min for the project to provision
4. From the project dashboard, collect:
   - **Project URL** (Settings → API → Project URL)
   - **anon public key** (Settings → API → Project API keys → anon public)
   - **service_role key** (Settings → API → Project API keys → service_role — KEEP SECRET)
   - **Database URL — Connection pooling** (Settings → Database → Connection pooling → URI, transaction mode, port 6543) — append `?pgbouncer=true&connection_limit=1`
   - **Database URL — Direct** (Settings → Database → Connection string → URI, port 5432)
5. Settings → Authentication → Providers → Email: ensure **Enable Email signup** is ON. Leave "Confirm email" ON (production-ready); our dev signup bypasses it via the admin API + `SUPABASE_AUTO_CONFIRM=true` env var.

These five values feed the env vars below. Paste them into `.env` files when prompted.

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@app/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } },
  "scripts": {
    "generate": "prisma generate",
    "migrate": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",
    "studio": "prisma studio",
    "seed": "tsx src/seed.ts",
    "typecheck": "tsc --noEmit"
  },
  "prisma": { "schema": "prisma/schema.prisma" },
  "dependencies": { "@prisma/client": "^5.21.1" },
  "devDependencies": {
    "@app/config": "workspace:*",
    "prisma": "^5.21.1",
    "tsx": "^4.19.1",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "@app/config/tsconfig",
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `packages/db/.env.example`**

```
# Paste from your restaurant Supabase project:
#   - Pooled URL (port 6543) goes in DATABASE_URL with ?pgbouncer=true&connection_limit=1
#   - Direct URL  (port 5432) goes in DIRECT_URL — required by Prisma migrations
DATABASE_URL="postgresql://postgres.<project-ref>:<db-password>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:<db-password>@db.<project-ref>.supabase.co:5432/postgres"
```

Then: `cp packages/db/.env.example packages/db/.env` and replace `<project-ref>` and `<db-password>` with the real values from the Supabase dashboard.

- [ ] **Step 4: Create `packages/db/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum Role {
  owner
  manager
  kitchen
  bar
  cashier
}

// Mirror of supabase auth.users.id (UUID). Populated by signup server action.
model User {
  id           String       @id @db.Uuid
  email        String       @unique
  name         String?
  createdAt    DateTime     @default(now())
  lastLoginAt  DateTime?
  memberships  Membership[]
}

model Restaurant {
  id               String       @id @default(cuid())
  slug             String       @unique
  name             String
  address          String?
  currency         String       @default("EUR")
  taxRate          Decimal      @default(0) @db.Decimal(5, 2)
  serviceChargePct Decimal      @default(0) @db.Decimal(5, 2)
  createdAt        DateTime     @default(now())
  memberships      Membership[]
}

model Membership {
  id           String     @id @default(cuid())
  userId       String     @db.Uuid
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  role         Role
  createdAt    DateTime   @default(now())

  @@unique([userId, restaurantId])
  @@index([restaurantId])
}
```

- [ ] **Step 5: Create initial migration**

Run: `pnpm -F @app/db exec prisma migrate dev --name init`
Expected: migration generated under `packages/db/prisma/migrations/` and applied to the cloud DB. Verify in Supabase dashboard → Table Editor that `User`, `Restaurant`, `Membership` tables exist.

- [ ] **Step 6: Create `packages/db/src/index.ts`**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type * from "@prisma/client";
export { Prisma } from "@prisma/client";
```

- [ ] **Step 7: Create `packages/db/src/seed.ts`**

```ts
import { prisma } from "./index.js";

async function main() {
  console.log("Seed: nothing to seed yet (Phase 1A).");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
```

- [ ] **Step 8: Verify Prisma client compiles**

Run: `pnpm -F @app/db typecheck`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(db): add prisma schema mirrored to supabase auth.users (User/Restaurant/Membership)"
```

---

### Task 4: Scaffold Next.js app skeleton with Tailwind and Supabase env vars

**Files:**

- Create: `apps/web/package.json`, `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.env.example`, `lib/db.ts`, `.eslintrc.cjs`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@app/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@app/db": "workspace:*",
    "@app/shared": "workspace:*",
    "@supabase/ssr": "^0.5.1",
    "@supabase/supabase-js": "^2.45.4",
    "next": "14.2.15",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@app/config": "workspace:*",
    "@types/node": "^20.16.13",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.13.0",
    "eslint-config-next": "14.2.15",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "@app/config/tsconfig",
  "compilerOptions": {
    "noEmit": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".next"]
}
```

- [ ] **Step 3: Create `apps/web/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { allowedOrigins: ["localhost:3000"] } },
  transpilePackages: ["@app/db", "@app/shared"],
};
export default nextConfig;
```

- [ ] **Step 4: Create `apps/web/.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "next/typescript"],
};
```

- [ ] **Step 5: Create `apps/web/tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f7ff",
          500: "#5b6cff",
          600: "#4a5ae6",
          700: "#3a48bf",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 6: Create `apps/web/postcss.config.mjs`**

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 7: Create `apps/web/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
}
html,
body {
  @apply h-full bg-white text-slate-900 antialiased;
}

@layer components {
  .input {
    @apply focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:outline-none;
  }
}
```

- [ ] **Step 8: Create `apps/web/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Restaurant Platform",
  description: "QR-code dine-in ordering for restaurants.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Create `apps/web/app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Restaurant Platform</h1>
      <p className="text-slate-600">QR-code dine-in ordering for restaurants.</p>
      <div className="flex gap-3">
        <a
          className="bg-brand-500 hover:bg-brand-600 rounded-md px-4 py-2 text-white"
          href="/signup"
        >
          Get started
        </a>
        <a className="rounded-md border px-4 py-2 hover:bg-slate-50" href="/login">
          Log in
        </a>
      </div>
    </main>
  );
}
```

- [ ] **Step 10: Create `apps/web/lib/db.ts`**

```ts
export { prisma, Prisma } from "@app/db";
export type * from "@app/db";
```

- [ ] **Step 11: Create `apps/web/.env.example`**

```
# Database (Prisma) — restaurant Supabase project
DATABASE_URL="postgresql://postgres.<project-ref>:<db-password>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:<db-password>@db.<project-ref>.supabase.co:5432/postgres"

# Supabase (public)
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon public key from Supabase dashboard>"

# Supabase (server-only — never expose to browser)
SUPABASE_SERVICE_ROLE_KEY="<service_role key from Supabase dashboard>"

# Dev only: bypass email confirmation. Leave UNSET in production.
SUPABASE_AUTO_CONFIRM="true"
```

Then: `cp apps/web/.env.example apps/web/.env.local` and replace the placeholders with the real values from your Supabase project.

- [ ] **Step 12: Install workspace deps**

Run: `pnpm install`

- [ ] **Step 13: Smoke test**

Run: `pnpm dev`
Open: http://localhost:3000
Expected: landing page renders. Stop with Ctrl+C.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(web): scaffold Next.js 14 with Tailwind and Supabase env wiring"
```

---

### Task 5: Set up Vitest and Playwright

**Files:**

- Create: `apps/web/vitest.config.ts`, `__tests__/setup.ts`, `playwright.config.ts`, `__tests__/smoke.test.ts`

- [ ] **Step 1: Add test devDeps**

Run:

```bash
pnpm -F @app/web add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom @playwright/test
```

- [ ] **Step 2: Create `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
    exclude: ["__tests__/e2e/**"],
    coverage: { reporter: ["text", "html"], include: ["lib/**", "server/**"] },
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
});
```

- [ ] **Step 3: Create `apps/web/__tests__/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Create `apps/web/__tests__/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run Vitest**

Run: `pnpm -F @app/web test`
Expected: 1 passed.

- [ ] **Step 6: Create `apps/web/playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./__tests__/e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
  },
});
```

- [ ] **Step 7: Install Playwright browsers**

Run: `pnpm -F @app/web exec playwright install --with-deps chromium`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore(web): set up vitest and playwright"
```

---

### Task 6: Build `lib/slug.ts` with TDD

**Files:**

- Create: `apps/web/lib/slug.ts`, `__tests__/lib/slug.test.ts`

- [ ] **Step 1: Write failing test `apps/web/__tests__/lib/slug.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { slugify, generateUniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and dashes", () => {
    expect(slugify("The Golden Fork!")).toBe("the-golden-fork");
  });
  it("strips diacritics", () => {
    expect(slugify("Καφέ Λουκούμι")).toBe("kafe-loukoumi");
  });
  it("collapses runs and trims", () => {
    expect(slugify("  Hello -- World  ")).toBe("hello-world");
  });
});

describe("generateUniqueSlug", () => {
  it("returns base when free", async () => {
    const exists = vi.fn().mockResolvedValue(false);
    expect(await generateUniqueSlug("Cafe", exists)).toBe("cafe");
    expect(exists).toHaveBeenCalledWith("cafe");
  });
  it("appends -2, -3 until free", async () => {
    const taken = new Set(["cafe", "cafe-2"]);
    const exists = vi.fn(async (s: string) => taken.has(s));
    expect(await generateUniqueSlug("Cafe", exists)).toBe("cafe-3");
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm -F @app/web test slug`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/lib/slug.ts`**

```ts
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function generateUniqueSlug(
  raw: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(raw) || "restaurant";
  if (!(await exists(base))) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("Could not generate unique slug after 1000 attempts.");
}
```

- [ ] **Step 4: Run, expect pass**

Run: `pnpm -F @app/web test slug`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): add slugify and generateUniqueSlug helpers"
```

---

### Task 7: Build shared zod schemas in `packages/shared`

**Files:**

- Create: `packages/shared/package.json`, `tsconfig.json`, `src/index.ts`, `src/zod/auth.ts`, `src/zod/restaurant.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@app/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./zod/auth": "./src/zod/auth.ts",
    "./zod/restaurant": "./src/zod/restaurant.ts"
  },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": { "@app/config": "workspace:*", "typescript": "^5.6.3" }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{ "extends": "@app/config/tsconfig", "include": ["src/**/*"] }
```

- [ ] **Step 3: Create `packages/shared/src/zod/auth.ts`**

```ts
import { z } from "zod";

export const SignupInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "At least 8 characters.").max(128),
  name: z.string().trim().min(1).max(80).optional(),
});
export type SignupInput = z.infer<typeof SignupInput>;

export const LoginInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;
```

- [ ] **Step 4: Create `packages/shared/src/zod/restaurant.ts`**

```ts
import { z } from "zod";

export const CURRENCIES = ["EUR", "USD", "GBP"] as const;
export const CurrencySchema = z.enum(CURRENCIES);
export type Currency = z.infer<typeof CurrencySchema>;

export const CreateRestaurantInput = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).optional(),
  currency: CurrencySchema.default("EUR"),
  taxRatePct: z.coerce.number().min(0).max(100).default(0),
  serviceChargePct: z.coerce.number().min(0).max(100).default(0),
});
export type CreateRestaurantInput = z.infer<typeof CreateRestaurantInput>;
```

- [ ] **Step 5: Create `packages/shared/src/index.ts`**

```ts
export * from "./zod/auth.js";
export * from "./zod/restaurant.js";
```

- [ ] **Step 6: Install + typecheck**

Run: `pnpm install && pnpm -F @app/shared typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(shared): add zod schemas for auth and restaurant"
```

---

### Task 8: Build Supabase client helpers (browser, server, admin, middleware)

**Files:**

- Create: `apps/web/lib/supabase-browser.ts`, `supabase-server.ts`, `supabase-admin.ts`, `supabase-middleware.ts`, `auth-helpers.ts`

- [ ] **Step 1: Create `apps/web/lib/supabase-browser.ts`**

```ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: Create `apps/web/lib/supabase-server.ts`**

```ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options: CookieOptions) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Called from a Server Component — middleware will refresh next time.
          }
        },
        remove: (name, options: CookieOptions) => {
          try {
            cookieStore.set(name, "", { ...options, maxAge: 0 });
          } catch {
            // Same as above.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Create `apps/web/lib/supabase-admin.ts`**

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

let cached: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  return cached;
}
```

- [ ] **Step 4: Create `apps/web/lib/supabase-middleware.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function updateSession(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options: CookieOptions) => {
          req.cookies.set({ name, value, ...options });
          res = NextResponse.next({ request: req });
          res.cookies.set({ name, value, ...options });
        },
        remove: (name, options: CookieOptions) => {
          req.cookies.set({ name, value: "", ...options });
          res = NextResponse.next({ request: req });
          res.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { res, user };
}
```

- [ ] **Step 5: Create `apps/web/lib/auth-helpers.ts`**

```ts
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/db";

export async function getSessionUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireSession() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRestaurant() {
  const user = await requireSession();
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { restaurantId: true, role: true, restaurant: { select: { name: true, slug: true } } },
  });
  if (!membership) redirect("/onboarding");
  return {
    user,
    restaurantId: membership.restaurantId,
    role: membership.role,
    restaurant: membership.restaurant,
  };
}
```

- [ ] **Step 6: Verify it compiles**

Run: `pnpm -F @app/web typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): add supabase client helpers (browser/server/admin/middleware) and auth helpers"
```

---

### Task 9: Implement signup server action with TDD (Supabase admin + mirror)

**Files:**

- Create: `apps/web/server/actions/auth.ts`
- Create: `apps/web/__tests__/server/actions/auth.test.ts`
- Create: `apps/web/__tests__/_helpers/db.ts`
- Create: `apps/web/__tests__/_helpers/supabase.ts`

- [ ] **Step 1: Create test DB reset helper `apps/web/__tests__/_helpers/db.ts`**

```ts
import { prisma } from "@/lib/db";

export async function resetDb() {
  await prisma.$transaction([
    prisma.membership.deleteMany(),
    prisma.restaurant.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
```

- [ ] **Step 2: Create supabase auth reset helper `apps/web/__tests__/_helpers/supabase.ts`**

```ts
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function resetSupabaseAuthUsers() {
  const admin = getSupabaseAdmin();
  // Page through all users (test runs against a fresh local stack — should be small)
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  for (const u of data.users) {
    await admin.auth.admin.deleteUser(u.id);
  }
}
```

- [ ] **Step 3: Write failing test `apps/web/__tests__/server/actions/auth.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { signupAction } from "@/server/actions/auth";
import { prisma } from "@/lib/db";
import { resetDb } from "../../_helpers/db";
import { resetSupabaseAuthUsers } from "../../_helpers/supabase";

describe("signupAction", () => {
  beforeEach(async () => {
    await resetDb();
    await resetSupabaseAuthUsers();
  });

  it("creates a Supabase auth user and a mirrored public.User row", async () => {
    const result = await signupAction({
      email: "Owner@Example.COM",
      password: "Sup3rSecret!",
      name: "Owner",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const user = await prisma.user.findUnique({ where: { email: "owner@example.com" } });
    expect(user).not.toBeNull();
    expect(user!.id).toBe(result.data.userId);
    expect(user!.name).toBe("Owner");
  });

  it("rejects duplicate email", async () => {
    await signupAction({ email: "dup@example.com", password: "Sup3rSecret!" });
    const second = await signupAction({ email: "dup@example.com", password: "Sup3rSecret!" });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects invalid input with VALIDATION error", async () => {
    const result = await signupAction({ email: "not-an-email", password: "short" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
  });
});
```

- [ ] **Step 4: Run, expect fail**

Run: `pnpm -F @app/web test auth`
Expected: FAIL — `signupAction` not found.

- [ ] **Step 5: Implement `apps/web/server/actions/auth.ts`**

```ts
"use server";

import { SignupInput } from "@app/shared/zod/auth";
import { prisma } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } };

export async function signupAction(raw: unknown): Promise<ActionResult<{ userId: string }>> {
  const parsed = SignupInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Invalid input.",
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      },
    };
  }
  const { email, password, name } = parsed.data;

  const admin = getSupabaseAdmin();

  // SUPABASE_AUTO_CONFIRM=true bypasses the email-confirmation step.
  // Set in .env.local for dev, leave UNSET in production so real users must verify.
  const autoConfirm = process.env.SUPABASE_AUTO_CONFIRM === "true";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: autoConfirm,
    user_metadata: name ? { name } : undefined,
  });

  if (error) {
    if (error.status === 422 || /already registered/i.test(error.message)) {
      return { ok: false, error: { code: "EMAIL_TAKEN", message: "Email already in use." } };
    }
    return { ok: false, error: { code: "AUTH_CREATE_FAILED", message: error.message } };
  }
  if (!data.user) {
    return {
      ok: false,
      error: { code: "AUTH_CREATE_FAILED", message: "Supabase returned no user." },
    };
  }

  // Mirror into public.User. If this fails, roll back the auth user to keep them in sync.
  try {
    await prisma.user.create({
      data: { id: data.user.id, email, name: name ?? null },
    });
  } catch (err) {
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw err;
  }

  return { ok: true, data: { userId: data.user.id } };
}
```

- [ ] **Step 6: Run, expect pass**

Run: `pnpm -F @app/web test auth`
Expected: 3 passed.

(Local Supabase must be running: `supabase status` should show ok.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): add signupAction using Supabase admin + public.User mirror"
```

---

### Task 10: Build signup page with form and e2e

**Files:**

- Create: `apps/web/app/(auth)/layout.tsx`, `(auth)/signup/page.tsx`, `components/auth/signup-form.tsx`, `__tests__/e2e/signup.spec.ts`

- [ ] **Step 1: Install form deps**

Run: `pnpm -F @app/web add react-hook-form @hookform/resolvers`

- [ ] **Step 2: Create `apps/web/app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/components/auth/signup-form.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SignupInput } from "@app/shared/zod/auth";
import { signupAction } from "@/server/actions/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function SignupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({ resolver: zodResolver(SignupInput) });

  const onSubmit = (values: SignupInput) => {
    setServerError(null);
    startTransition(async () => {
      // Create the user server-side (admin + mirror).
      const result = await signupAction(values);
      if (!result.ok) {
        setServerError(result.error.message);
        return;
      }
      // Now sign in client-side so the cookie session lands.
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        setServerError("Account created but sign-in failed. Try logging in.");
        return;
      }
      router.replace("/onboarding");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <Field label="Name" error={errors.name?.message}>
        <input {...register("name")} className="input" autoComplete="name" />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <input {...register("email")} type="email" className="input" autoComplete="email" />
      </Field>
      <Field label="Password" error={errors.password?.message}>
        <input
          {...register("password")}
          type="password"
          className="input"
          autoComplete="new-password"
        />
      </Field>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-500 hover:bg-brand-600 w-full rounded-md px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create account"}
      </button>
      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <a href="/login" className="text-brand-600 underline">
          Log in
        </a>
      </p>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
```

- [ ] **Step 4: Create `apps/web/app/(auth)/signup/page.tsx`**

```tsx
import { SignupForm } from "@/components/auth/signup-form";

export const metadata = { title: "Sign up — Restaurant Platform" };

export default function SignupPage() {
  return <SignupForm />;
}
```

- [ ] **Step 5: Write e2e test `apps/web/__tests__/e2e/signup.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("user can sign up and lands on onboarding", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("E2E Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Sup3rSecret!");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);
});
```

- [ ] **Step 6: Reset Postgres + Supabase auth and run e2e**

```bash
pnpm -F @app/db exec prisma migrate reset --force --skip-seed
# Supabase auth.users persists across prisma resets — clear via studio or:
node -e "(async()=>{const {createClient}=await import('@supabase/supabase-js');const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const {data}=await a.auth.admin.listUsers();for(const u of data.users){await a.auth.admin.deleteUser(u.id)}})()" \
  --env-file=apps/web/.env.local
pnpm -F @app/web test:e2e signup
```

Expected: signup e2e passes (URL ends `/onboarding` — page may 404 until Task 12 wires onboarding; URL match still succeeds).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): add signup page (Supabase admin createUser + client signIn)"
```

---

### Task 11: Build login page with e2e

**Files:**

- Create: `apps/web/app/(auth)/login/page.tsx`, `components/auth/login-form.tsx`, `__tests__/e2e/login.spec.ts`

- [ ] **Step 1: Create `apps/web/components/auth/login-form.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginInput } from "@app/shared/zod/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") ?? "/dashboard";
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(LoginInput) });

  const onSubmit = (values: LoginInput) => {
    setServerError(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword(values);
      if (error) {
        setServerError("Invalid email or password.");
        return;
      }
      router.replace(callbackUrl);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
        <input {...register("email")} type="email" className="input" autoComplete="email" />
        {errors.email && (
          <span className="mt-1 block text-xs text-red-600">{errors.email.message}</span>
        )}
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
        <input
          {...register("password")}
          type="password"
          className="input"
          autoComplete="current-password"
        />
        {errors.password && (
          <span className="mt-1 block text-xs text-red-600">{errors.password.message}</span>
        )}
      </label>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-500 hover:bg-brand-600 w-full rounded-md px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Log in"}
      </button>
      <p className="text-center text-sm text-slate-600">
        New here?{" "}
        <a href="/signup" className="text-brand-600 underline">
          Create an account
        </a>
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Create `apps/web/app/(auth)/login/page.tsx`**

```tsx
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Log in — Restaurant Platform" };

export default function LoginPage() {
  return <LoginForm />;
}
```

- [ ] **Step 3: Write e2e test `apps/web/__tests__/e2e/login.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("user can log in with previously created account", async ({ page }) => {
  const email = `login-${Date.now()}@example.com`;
  // Sign up first
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Login Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Sup3rSecret!");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  // Log out
  await page.context().clearCookies();

  // Log in
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Sup3rSecret!");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/(onboarding|dashboard)/);
});
```

- [ ] **Step 4: Run e2e**

Run: `pnpm -F @app/web test:e2e login`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): add login page using Supabase signInWithPassword"
```

---

### Task 12: Implement restaurant onboarding wizard with TDD

**Files:**

- Create: `apps/web/server/actions/restaurant.ts`, `__tests__/server/actions/restaurant.test.ts`, `app/(admin)/onboarding/page.tsx`, `components/admin/onboarding-form.tsx`, `__tests__/e2e/onboarding.spec.ts`

- [ ] **Step 1: Write failing unit test `apps/web/__tests__/server/actions/restaurant.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createRestaurantForUser } from "@/server/actions/restaurant";
import { prisma } from "@/lib/db";
import { resetDb } from "../../_helpers/db";
import { resetSupabaseAuthUsers } from "../../_helpers/supabase";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

async function makeUser(email = "owner@example.com") {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "Sup3rSecret!",
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("no user");
  await prisma.user.create({ data: { id: data.user.id, email, name: "Owner" } });
  return { id: data.user.id };
}

describe("createRestaurantForUser", () => {
  beforeEach(async () => {
    await resetDb();
    await resetSupabaseAuthUsers();
  });

  it("creates restaurant + owner membership and unique slug", async () => {
    const user = await makeUser();
    const result = await createRestaurantForUser(user.id, {
      name: "The Golden Fork",
      currency: "EUR",
      taxRatePct: 13,
      serviceChargePct: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const r = await prisma.restaurant.findUnique({
      where: { id: result.data.restaurantId },
      include: { memberships: true },
    });
    expect(r?.slug).toBe("the-golden-fork");
    expect(r?.taxRate.toString()).toBe("13");
    expect(r?.memberships).toHaveLength(1);
    expect(r?.memberships[0]?.role).toBe("owner");
    expect(r?.memberships[0]?.userId).toBe(user.id);
  });

  it("appends suffix when slug taken", async () => {
    const u1 = await makeUser("a@example.com");
    const u2 = await makeUser("b@example.com");
    await createRestaurantForUser(u1.id, {
      name: "Cafe",
      currency: "EUR",
      taxRatePct: 0,
      serviceChargePct: 0,
    });
    const second = await createRestaurantForUser(u2.id, {
      name: "Cafe",
      currency: "EUR",
      taxRatePct: 0,
      serviceChargePct: 0,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const r = await prisma.restaurant.findUnique({ where: { id: second.data.restaurantId } });
    expect(r?.slug).toBe("cafe-2");
  });

  it("rejects invalid input with VALIDATION", async () => {
    const user = await makeUser();
    const result = await createRestaurantForUser(user.id, { name: "x" } as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm -F @app/web test restaurant`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/server/actions/restaurant.ts`**

```ts
"use server";

import { CreateRestaurantInput } from "@app/shared/zod/restaurant";
import { prisma } from "@/lib/db";
import { generateUniqueSlug } from "@/lib/slug";
import type { ActionResult } from "@/server/actions/auth";
import { getSessionUser } from "@/lib/auth-helpers";

export async function createRestaurantForUser(
  userId: string,
  raw: unknown,
): Promise<ActionResult<{ restaurantId: string; slug: string }>> {
  const parsed = CreateRestaurantInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Invalid input.",
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      },
    };
  }
  const { name, address, currency, taxRatePct, serviceChargePct } = parsed.data;

  const slug = await generateUniqueSlug(name, async (s) =>
    Boolean(await prisma.restaurant.findUnique({ where: { slug: s }, select: { id: true } })),
  );

  const restaurant = await prisma.restaurant.create({
    data: {
      slug,
      name,
      address: address ?? null,
      currency,
      taxRate: taxRatePct,
      serviceChargePct,
      memberships: { create: { userId, role: "owner" } },
    },
    select: { id: true, slug: true },
  });

  return { ok: true, data: { restaurantId: restaurant.id, slug: restaurant.slug } };
}

export async function createRestaurantAction(
  raw: unknown,
): Promise<ActionResult<{ restaurantId: string; slug: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: { code: "UNAUTHENTICATED", message: "Not signed in." } };
  return createRestaurantForUser(user.id, raw);
}
```

- [ ] **Step 4: Run, expect pass**

Run: `pnpm -F @app/web test restaurant`
Expected: 3 passed.

- [ ] **Step 5: Create `apps/web/components/admin/onboarding-form.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateRestaurantInput, CURRENCIES } from "@app/shared/zod/restaurant";
import { createRestaurantAction } from "@/server/actions/restaurant";

type FormValues = ReturnType<typeof CreateRestaurantInput.parse>;

export function OnboardingForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(CreateRestaurantInput),
    defaultValues: { currency: "EUR", taxRatePct: 0, serviceChargePct: 0 },
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createRestaurantAction(values);
      if (!result.ok) {
        setServerError(result.error.message);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h1 className="text-2xl font-semibold">Create your restaurant</h1>
      <p className="text-sm text-slate-600">You can edit any of this later in Settings.</p>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Restaurant name</span>
        <input {...register("name")} className="input" />
        {errors.name && (
          <span className="mt-1 block text-xs text-red-600">{errors.name.message}</span>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Address (optional)</span>
        <input {...register("address")} className="input" />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Currency</span>
          <select {...register("currency")} className="input">
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Tax %</span>
          <input
            {...register("taxRatePct", { valueAsNumber: true })}
            type="number"
            step="0.01"
            className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Service %</span>
          <input
            {...register("serviceChargePct", { valueAsNumber: true })}
            type="number"
            step="0.01"
            className="input"
          />
        </label>
      </div>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-brand-500 hover:bg-brand-600 w-full rounded-md px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create restaurant"}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Create `apps/web/app/(admin)/onboarding/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { OnboardingForm } from "@/components/admin/onboarding-form";

export const metadata = { title: "Create your restaurant" };

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const existing = await prisma.membership.findFirst({
    where: { userId: user.id },
    select: { restaurantId: true },
  });
  if (existing) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-lg p-8">
      <OnboardingForm />
    </div>
  );
}
```

- [ ] **Step 7: E2E test `apps/web/__tests__/e2e/onboarding.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("new user signs up, creates restaurant, lands on dashboard", async ({ page }) => {
  const email = `onboard-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Onboard Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Sup3rSecret!");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  await page.getByLabel("Restaurant name").fill("The Golden Fork");
  await page.getByLabel("Tax %").fill("13");
  await page.getByRole("button", { name: /create restaurant/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/the golden fork/i)).toBeVisible();
});
```

- [ ] **Step 8: (Defer running e2e until Task 13 wires the dashboard.)**

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(web): add restaurant onboarding wizard with server action and form"
```

---

### Task 13: Build admin layout, dashboard placeholder, middleware, tenant helper

**Files:**

- Create: `apps/web/middleware.ts`, `app/(admin)/layout.tsx`, `app/(admin)/dashboard/page.tsx`, `components/admin/sidebar.tsx`, `components/admin/topbar.tsx`, `lib/tenant.ts`, `__tests__/lib/tenant.test.ts`

- [ ] **Step 1: Create `apps/web/middleware.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase-middleware";

const PROTECTED = [
  /^\/dashboard/,
  /^\/onboarding/,
  /^\/orders/,
  /^\/menu/,
  /^\/tables/,
  /^\/staff/,
  /^\/reports/,
  /^\/settings/,
];

export default async function middleware(req: NextRequest) {
  const { res, user } = await updateSession(req);

  const isProtected = PROTECTED.some((re) => re.test(req.nextUrl.pathname));
  if (isProtected && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next|api|favicon|.*\\..*).*)"],
};
```

- [ ] **Step 2: Create `apps/web/components/admin/sidebar.tsx`**

```tsx
import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/orders", label: "Orders" },
  { href: "/menu", label: "Menu" },
  { href: "/tables", label: "Tables" },
  { href: "/staff", label: "Staff" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r bg-slate-50 p-4 lg:block">
      <div className="mb-6 px-2 text-sm font-semibold text-slate-500">RESTAURANT</div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-white"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Create `apps/web/components/admin/topbar.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function Topbar({
  restaurantName,
  userEmail,
}: {
  restaurantName: string;
  userEmail: string;
}) {
  const router = useRouter();
  const onSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };
  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-3">
      <h2 className="text-lg font-semibold">{restaurantName}</h2>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-600">{userEmail}</span>
        <button onClick={onSignOut} className="rounded-md border px-3 py-1.5 hover:bg-slate-50">
          Sign out
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create `apps/web/app/(admin)/layout.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/admin/sidebar";
import { Topbar } from "@/components/admin/topbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { restaurant: { select: { name: true } } },
  });

  // Onboarding shows children only — no shell until the user has a restaurant.
  if (!membership) {
    return <main className="min-h-screen bg-slate-50">{children}</main>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar restaurantName={membership.restaurant.name} userEmail={user.email!} />
        <main className="flex-1 bg-white p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `apps/web/app/(admin)/dashboard/page.tsx`**

```tsx
import { requireRestaurant } from "@/lib/auth-helpers";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { restaurant, restaurantId } = await requireRestaurant();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{restaurant.name}</h1>
      <p className="text-slate-600">
        Slug: <code className="rounded bg-slate-100 px-1.5 py-0.5">{restaurant.slug}</code> · ID:{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5">{restaurantId}</code>
      </p>
      <div className="rounded-lg border border-dashed p-8 text-center text-slate-500">
        Dashboard widgets land here in Phase 5. For now, head to{" "}
        <a href="/menu" className="text-brand-600 underline">
          Menu
        </a>{" "}
        or{" "}
        <a href="/tables" className="text-brand-600 underline">
          Tables
        </a>{" "}
        (coming in Phase 1B).
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write failing test `apps/web/__tests__/lib/tenant.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { membership: { findFirst: vi.fn() } },
}));

import { currentRestaurantId } from "@/lib/tenant";
import { getSessionUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";

describe("currentRestaurantId", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns restaurantId from primary membership", async () => {
    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", email: "x" });
    (prisma.membership.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      restaurantId: "r1",
    });
    expect(await currentRestaurantId()).toBe("r1");
  });

  it("returns null when no session", async () => {
    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await currentRestaurantId()).toBeNull();
  });

  it("returns null when user has no membership yet", async () => {
    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", email: "x" });
    (prisma.membership.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await currentRestaurantId()).toBeNull();
  });
});
```

- [ ] **Step 7: Run, expect fail**

Run: `pnpm -F @app/web test tenant`
Expected: FAIL — module not found.

- [ ] **Step 8: Implement `apps/web/lib/tenant.ts`**

```ts
import { getSessionUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";

export async function currentRestaurantId(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const m = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { restaurantId: true },
  });
  return m?.restaurantId ?? null;
}
```

- [ ] **Step 9: Run, expect pass**

Run: `pnpm -F @app/web test tenant`
Expected: 3 passed.

- [ ] **Step 10: Reset and run full e2e**

```bash
pnpm -F @app/db exec prisma migrate reset --force --skip-seed
node --env-file=apps/web/.env.local -e "(async()=>{const {createClient}=await import('@supabase/supabase-js');const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const {data}=await a.auth.admin.listUsers();for(const u of data.users){await a.auth.admin.deleteUser(u.id)}})()"
pnpm -F @app/web test:e2e
```

Expected: signup, login, onboarding e2e all pass.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(web): add admin layout, dashboard, supabase middleware, tenant helper"
```

---

### Task 14: Set up GitHub Actions CI

**Files:**

- Create: `.github/workflows/ci.yml`

CI runs lint + typecheck + pure-logic unit tests + Next build. Tests that hit Supabase Auth (`auth.test.ts`, `restaurant.test.ts`) are excluded from CI — they're integration tests that run locally against your `restaurant-dev` Supabase project. A nightly job can be added later to run them against a dedicated CI Supabase project. The `next build` step needs DB access for Prisma generation, so CI uses a Postgres service container only for the build.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  build:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: postgres
        ports: ["54322:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres -d postgres"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:54322/postgres?schema=public
      DIRECT_URL: postgresql://postgres:postgres@localhost:54322/postgres?schema=public
      # Dummy public values so Next.js build doesn't fail on missing env.
      NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-anon-key-placeholder
      SUPABASE_SERVICE_ROLE_KEY: ci-service-role-key-placeholder
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.12.0 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm -F @app/db exec prisma migrate deploy
      - run: pnpm -F @app/db generate
      - run: pnpm lint
      - run: pnpm typecheck
      # Unit tests that need Supabase Auth are skipped here (require live Supabase).
      # We run only pure-logic tests (slug, tenant). Auth tests run on staging in nightly.
      - run: pnpm -F @app/web test -- --testPathIgnorePatterns "server/actions/(auth|restaurant)"
      - run: pnpm build
```

- [ ] **Step 2: Adjust Vitest CLI invocation**

Vitest `--testPathIgnorePatterns` is Jest-style. For Vitest, use `--exclude`:

Replace the test step with:

```yaml
- run: pnpm -F @app/web exec vitest run --exclude "**/__tests__/server/actions/(auth|restaurant).test.ts" --exclude "**/__tests__/e2e/**"
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "ci: add GitHub Actions for lint/typecheck/unit/build"
```

---

### Task 15: Deploy to Vercel against the same Supabase project

**Files:**

- Create: `docs/deploy/production.md`

Single Supabase project (`restaurant`) is reused for prod. The email-confirmation split is already wired in Task 9 via `SUPABASE_AUTO_CONFIRM`.

- [ ] **Step 1: Push the repo to GitHub**

```bash
git remote add origin <your repo url>
git push -u origin main
```

- [ ] **Step 2: Create Vercel project (manual)**

1. https://vercel.com → New Project → import the GitHub repo.
2. Framework: Next.js. Root: `apps/web`.
3. Install command: `pnpm install --frozen-lockfile`
4. Build command: `pnpm -w build`
5. Environment variables (Production):
   - `DATABASE_URL` = pooled URL (port 6543 + `?pgbouncer=true&connection_limit=1`)
   - `DIRECT_URL` = direct URL (port 5432)
   - `NEXT_PUBLIC_SUPABASE_URL` = project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role (mark secret)
   - **Do NOT** set `SUPABASE_AUTO_CONFIRM` in Vercel — leave unset so prod signups must confirm via email.

- [ ] **Step 3: Create `docs/deploy/production.md`**

```markdown
# Production deploy

- Hosting: Vercel project `restaurant-platform` (Root Dir: `apps/web`)
- Database + Auth + Storage: Supabase project `restaurant` (eu-central-1) — shared with dev
- URL: https://<vercel-project>.vercel.app

## Env vars

| Name                          | Local (.env.local) | Vercel (prod) | Notes                                                        |
| ----------------------------- | ------------------ | ------------- | ------------------------------------------------------------ |
| DATABASE_URL                  | ✓                  | ✓             | pooled URL, port 6543 + `?pgbouncer=true&connection_limit=1` |
| DIRECT_URL                    | ✓                  | ✓             | port 5432, used by Prisma migrations                         |
| NEXT_PUBLIC_SUPABASE_URL      | ✓                  | ✓             | same project URL                                             |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | ✓                  | ✓             | public                                                       |
| SUPABASE_SERVICE_ROLE_KEY     | ✓                  | ✓             | secret                                                       |
| SUPABASE_AUTO_CONFIRM         | `true`             | UNSET         | bypasses email confirmation in dev only                      |

## Operations

- Run new migrations: `DATABASE_URL=$DIRECT_URL pnpm -F @app/db exec prisma migrate deploy`
- Reset auth users: Supabase dashboard → Authentication → Users (filter by test email pattern).
- Tail logs: Vercel dashboard → Deployments → Runtime logs.
- Clean test data: filter by `e2e-` / `onboard-` / `login-` email prefixes and delete from the Auth Users table.
```

- [ ] **Step 4: Smoke test the deploy**

In a browser:

1. Wait for Vercel build to succeed.
2. Visit `https://<vercel-project>.vercel.app` → landing page.
3. Click "Get started" → sign up with a real email → check inbox for confirmation link → confirm → log in → enter restaurant → land on dashboard.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(deploy): document Vercel + Supabase production deploy"
```

---

## Phase 1A Done — Acceptance Checks

- [ ] `pnpm install` from a clean clone succeeds.
- [ ] `pnpm db:migrate` against the dev Supabase project succeeds.
- [ ] `pnpm dev` serves landing at http://localhost:3000.
- [ ] `pnpm test` — unit/integration pass.
- [ ] `pnpm test:e2e` — signup, login, onboarding e2e pass.
- [ ] `pnpm typecheck && pnpm lint && pnpm build` — exit 0.
- [ ] CI is green on `main`.
- [ ] Staging URL: signup → onboarding → dashboard works end-to-end.

When all checked, hand off to Phase 1B (menu CRUD + tables + QR).

---

## Notes for Phase 1B (next plan)

- Add Postgres RLS policies on `Restaurant`, `Membership`, `Category`, `MenuItem`, `Table`, `Order` — read `auth.uid()` from JWT to scope every row to the user's restaurants. This becomes possible because our `User.id` already equals `auth.users.id`.
- After onboarding, set `restaurantId` into Supabase user `app_metadata` so RLS policies can read it directly from `auth.jwt()` without an extra DB lookup. Use `supabaseAdmin.auth.admin.updateUserById(userId, { app_metadata: { restaurant_id: ... } })`.
- Add `Category`, `MenuItem`, `MenuItemImage`, `Table` Prisma models + migrations.
- Create Supabase Storage bucket `menu-images` with signed-upload server action.
- Add `qrcode` and `pdf-lib` deps for QR generation and printable PDF sheet.
- Add shadcn/ui components: dialog, dropdown-menu, table, tabs, switch.
