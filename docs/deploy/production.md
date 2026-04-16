# Production deploy

- Hosting: Vercel project `restaurant-platform` (Root Dir: `apps/web`)
- Database + Auth + Storage: Supabase project `restaurant` (eu-central-1) — shared with dev
- URL: https://<vercel-project>.vercel.app

## Env vars

| Name | Local (.env.local) | Vercel (prod) | Notes |
|---|---|---|---|
| DATABASE_URL | ✓ | ✓ | pooled URL, port 6543 + `?pgbouncer=true&connection_limit=1` |
| DIRECT_URL | ✓ | ✓ | port 5432, used by Prisma migrations |
| NEXT_PUBLIC_SUPABASE_URL | ✓ | ✓ | same project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | ✓ | ✓ | public |
| SUPABASE_SERVICE_ROLE_KEY | ✓ | ✓ | secret |
| SUPABASE_AUTO_CONFIRM | `true` | UNSET | bypasses email confirmation in dev only |

## Operations

- Run new migrations: `DATABASE_URL=$DIRECT_URL pnpm -F @app/db exec prisma migrate deploy`
- Reset auth users: Supabase dashboard → Authentication → Users (filter by test email pattern).
- Tail logs: Vercel dashboard → Deployments → Runtime logs.
- Clean test data: filter by `e2e-` / `onboard-` / `login-` email prefixes and delete from the Auth Users table.
