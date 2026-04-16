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

App at http://localhost:3000. Studio: https://supabase.com (your `restaurant` project → Table Editor).
