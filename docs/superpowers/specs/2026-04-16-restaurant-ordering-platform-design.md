# Restaurant Online Ordering Platform — Design Document

**Date:** 2026-04-16
**Status:** Draft for review
**Owner:** itdevgr24@gmail.com

---

## 1. Product Overview

A multi-tenant SaaS that lets restaurants accept dine-in orders via table-side QR codes. Customers scan the QR at their table, browse the menu, place an order, and pay by card (Stripe) or cash. Orders auto-route to the right station — Kitchen for food, Bar for drinks, Cashier for the full ticket and payment status. Restaurant owners manage their menu, tables, QR codes, and live orders from a dashboard.

**Positioning:** Lightweight alternative to Toast / Square for Restaurants for the dine-in QR-ordering use case. Designed for small-to-mid independent restaurants in single or small chain configurations.

**Key value props:**

- Zero install for diners — works in any phone browser
- Real-time order routing to the right station
- One subscription, all tables
- Multi-tenant by design — each restaurant fully isolated

---

## 2. Core Features

### Customer

- QR-scan → table-bound web app (no login)
- Browse categories and items with images, descriptions, modifiers
- Per-item notes ("no onions", "extra ice", "well done")
- Cart with running total, tax, and service charge
- Card (Stripe) or cash payment
- Order status feedback (real-time)

### Owner / Admin

- Email + password signup with email verification
- Restaurant onboarding wizard (name, address, currency, tax %, table count)
- Menu CRUD (categories, items, 1–3 images, price, station tag)
- Item availability toggle (in stock / 86'd)
- Table management with unique QR generation + printable PDF sheet
- Live order board, filter by station and status
- Sales summary by day / item

### Staff (Kitchen, Bar, Cashier)

- Department-scoped order queue
- Status updates (received → preparing → ready → served / paid)
- Printable ticket per order
- Real-time push (sound + visual) when new order arrives

---

## 3. User Roles

| Role                 | Scope                 | Auth                                       | Capabilities                                     |
| -------------------- | --------------------- | ------------------------------------------ | ------------------------------------------------ |
| **Customer (Diner)** | Single table session  | Anonymous + table token                    | View menu, order, pay                            |
| **Owner**            | One restaurant tenant | Email/password + optional MFA              | Full admin: menu, tables, staff, orders, billing |
| **Manager**          | One restaurant tenant | Email/password                             | Same as owner except billing & staff invitation  |
| **Kitchen**          | One restaurant tenant | Email/password (or PIN on shared terminal) | View food orders, update status                  |
| **Bar**              | One restaurant tenant | Email/password (or PIN)                    | View drink orders, update status                 |
| **Cashier**          | One restaurant tenant | Email/password (or PIN)                    | View all orders, mark cash payments received     |
| **Platform Admin**   | All tenants           | Separate console                           | Tenant ops, billing, support                     |

---

## 4. User Flows

### Customer Flow

1. Scan QR at table 7 → opens `/r/golden-fork/t/QtX9aB`
2. Backend validates token → loads restaurant + table context into a signed session cookie
3. Sees menu (sticky category nav, item grid, search)
4. Taps item → modal with image carousel, description, modifiers, qty, note field → "Add to cart"
5. Cart drawer → review → "Pay by card" or "Pay cash"
6. **Card:** Enter name + email → Stripe Payment Element → 3DS if required → confirmation screen + order code
7. **Cash:** Confirm → confirmation screen ("Pay your server when they bring the bill")
8. Order status page (auto-refresh via realtime) shows: received → preparing → ready → served

### Owner Onboarding Flow

1. Sign up with email/password → verify email
2. Wizard: restaurant name, address, currency, tax rate, service charge
3. Set number of tables → system generates unique tokens + downloadable QR PDF
4. Build first menu (or import CSV)
5. Invite staff (kitchen, bar, cashier)
6. Subscribe to plan (Stripe Billing) — 14-day free trial
7. Done — diners can scan

### Order-to-Kitchen Flow

1. Customer submits order
2. API creates `orders` row + `order_items` rows (each tagged with `station`)
3. Backend broadcasts to:
   - `restaurant:{id}:kitchen` — items where station = kitchen | both
   - `restaurant:{id}:bar` — items where station = bar | both
   - `restaurant:{id}:cashier` — full order
4. Stations receive websocket push, ticket appears on board, optional auto-print
5. Each station updates status; cashier sees combined progress

---

## 5. Database Schema

Tenant key on every row: `restaurant_id`. Enforced via Postgres Row-Level Security.

```sql
restaurants(id, slug, name, address, currency, tax_rate, service_charge_pct,
            stripe_account_id, stripe_subscription_id, plan, created_at)

users(id, email, password_hash, name, created_at, last_login_at)

memberships(id, user_id, restaurant_id, role, created_at)
  -- role ∈ owner | manager | kitchen | bar | cashier

tables(id, restaurant_id, number, label, token, qr_url, is_active, created_at)
  -- token: 16-char URL-safe random; UNIQUE globally

categories(id, restaurant_id, name, sort_order, is_active)

menu_items(id, restaurant_id, category_id, name, description, price_cents,
           station, is_available, sort_order, created_at)
  -- station ∈ kitchen | bar | both

menu_item_images(id, menu_item_id, url, sort_order)
  -- max 3 per item enforced at app level

modifiers(id, menu_item_id, name, price_cents, is_required, max_select)

orders(id, restaurant_id, table_id, code, status, payment_method, payment_status,
       customer_name, customer_email, subtotal_cents, tax_cents, service_cents,
       total_cents, stripe_payment_intent_id, notes, created_at, paid_at)
  -- status ∈ received | preparing | ready | served | cancelled
  -- payment_method ∈ card | cash
  -- payment_status ∈ unpaid | paid | refunded
  -- code: short human-readable like "A042"

order_items(id, order_id, menu_item_id, name_snapshot, station, qty,
            unit_price_cents, line_total_cents, note, status)
  -- name_snapshot: capture current name in case menu changes
  -- status ∈ new | preparing | ready | served

order_item_modifiers(id, order_item_id, modifier_id, name_snapshot, price_cents)

audit_log(id, restaurant_id, user_id, action, entity, entity_id, meta, created_at)

idempotency_keys(key, restaurant_id, response_hash, created_at)
```

**Indexes:**

- `(restaurant_id, status)` on orders
- `(restaurant_id, station, status)` on order_items
- UNIQUE on `tables.token`
- UNIQUE on `restaurants.slug`
- UNIQUE on `(restaurant_id, number)` on tables

---

## 6. Recommended Tech Stack

| Layer              | Choice                                                                                                                         | Why                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Frontend           | **Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui**                                                                | SSR for menu (SEO + speed), RSC for fast data fetching, mobile-first     |
| State / data       | **TanStack Query + Zustand (cart)**                                                                                            | Server cache + client cart                                               |
| Backend            | **Next.js Route Handlers + tRPC** (or REST)                                                                                    | Same repo, type-safe end-to-end                                          |
| Database           | **Postgres (Supabase or Neon)**                                                                                                | RLS for multi-tenancy, JSON support, robust                              |
| ORM                | **Prisma**                                                                                                                     | Type-safe, migrations, great DX                                          |
| Auth               | **Supabase Auth** or **NextAuth.js (Auth.js)** + email/password + magic link                                                   | Built-in MFA, session JWT works with RLS                                 |
| Real-time          | **Supabase Realtime** (Postgres CDC) or **Pusher / Ably**                                                                      | Push new orders to station boards                                        |
| Payments           | **Stripe** — Payment Element for diners; **Stripe Connect (Standard)** for owner payouts; Stripe Billing for SaaS subscription | Standard for restaurants; Connect lets each restaurant get paid directly |
| QR generation      | **`qrcode` npm package** (server-side PNG/SVG) + **`pdf-lib`** for printable sheet                                             | Generate at table-create time, cache in storage                          |
| File storage       | **Supabase Storage** or **S3 + CloudFront**                                                                                    | Menu item images                                                         |
| Email              | **Resend** or **Postmark**                                                                                                     | Order receipts, owner invites                                            |
| Printing           | **Browser print** + **PrintNode** (cloud printers, optional)                                                                   | Kitchen ticket printers                                                  |
| Hosting            | **Vercel** (frontend) + **Supabase / Neon** (DB)                                                                               | Zero ops, global edge                                                    |
| Cache / rate limit | **Upstash Redis**                                                                                                              | Edge-compatible, cheap                                                   |
| Monitoring         | **Sentry** + **PostHog** + **Better Stack**                                                                                    | Errors, product analytics, uptime                                        |
| CI/CD              | **GitHub Actions**                                                                                                             | Lint, test, type-check, deploy                                           |

**Alternative (more control):** NestJS API + Postgres on RDS + Prisma + Pusher + S3 + Stripe + Render/Railway.

---

## 7. System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       Diner's phone                           │
│   (Next.js PWA, /r/{slug}/t/{token})                          │
└──────────────────┬───────────────────────────────────────────┘
                   │ HTTPS
┌──────────────────▼─────────────────┐         ┌──────────────┐
│        Next.js (Vercel Edge)        │◄───────┤ Stripe (PI,  │
│   - Public menu pages (SSR/ISR)     │ webhk  │ Connect,     │
│   - Customer order flow             │        │ Billing)     │
│   - Owner dashboard (RSC)           │        └──────────────┘
│   - Route Handlers / tRPC           │
└─────┬───────────────────────┬───────┘
      │ Prisma                │ Realtime publish
┌─────▼─────────┐    ┌────────▼────────────┐    ┌────────────┐
│  Postgres     │    │ Supabase Realtime / │◄───┤ Station    │
│  (RLS by      │    │ Pusher channels     │    │ boards     │
│  restaurant)  │    │ kitchen/bar/cashier │    │ (web app)  │
└───────────────┘    └─────────────────────┘    └────────────┘
      │
┌─────▼──────────┐    ┌─────────────┐    ┌─────────────┐
│ Object Storage │    │ Resend      │    │ Sentry /    │
│ (item images,  │    │ (emails)    │    │ PostHog     │
│  QR PDFs)      │    └─────────────┘    └─────────────┘
└────────────────┘
```

**Key notes:**

- All requests pass through Next.js middleware that resolves tenant from URL or session
- DB queries go through Prisma with `restaurant_id` always in WHERE — RLS is the safety net
- Stripe webhook handler updates `orders.payment_status` and triggers realtime broadcast
- Realtime channels are namespaced per restaurant + department; auth tokens scoped to that restaurant

---

## 8. Admin Dashboard Features

**Layout:** Left sidebar (Orders, Menu, Tables, Staff, Reports, Settings, Billing) + topbar (restaurant name, role switcher, profile).

| Section           | Features                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Orders (Live)** | Real-time board with columns Received / Preparing / Ready / Served; filter by station; click for detail; action buttons; sound on new order |
| **Menu**          | Drag-reorder categories; CRUD items; inline edit price; bulk availability toggle; CSV import/export; image upload (1–3 per item) with crop  |
| **Tables**        | Add / rename / archive; bulk-create; printable QR PDF (one per table, with label "Table 7 — Golden Fork")                                   |
| **Staff**         | Invite by email; role assignment; PIN for shared station terminals; deactivate                                                              |
| **Reports**       | Daily revenue, top items, station throughput, payment method split, peak hours                                                              |
| **Settings**      | Restaurant info, currency, tax, service charge, hours, time zone, print options                                                             |
| **Billing**       | Plan, payment method, invoices (Stripe Customer Portal embed)                                                                               |

---

## 9. Customer-Facing Pages

| Route                                   | Purpose                                                           |
| --------------------------------------- | ----------------------------------------------------------------- |
| `/r/{slug}`                             | Restaurant landing (info, hours, sample menu — for marketing/SEO) |
| `/r/{slug}/t/{token}`                   | Table-bound menu home                                             |
| `/r/{slug}/t/{token}/item/{itemId}`     | Item detail modal/page                                            |
| `/r/{slug}/t/{token}/cart`              | Cart review                                                       |
| `/r/{slug}/t/{token}/checkout`          | Payment selection + Stripe Element                                |
| `/r/{slug}/t/{token}/order/{orderCode}` | Order status / receipt                                            |

Mobile-first, PWA-installable, large touch targets, sticky cart bar.

---

## 10. API Endpoints (REST style; tRPC equivalents apply)

### Public (table token in cookie)

- `GET /api/public/menu` — categories + available items (resolved from table cookie)
- `GET /api/public/items/{id}` — item detail
- `POST /api/public/orders` — create order (cash) or create + return Stripe PI client_secret (card)
- `GET /api/public/orders/{code}` — order status

### Owner / staff (JWT auth, restaurant scope from membership)

- `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/me`
- `GET/POST/PATCH/DELETE /api/categories`
- `GET/POST/PATCH/DELETE /api/items` + `POST /api/items/{id}/images`
- `GET/POST/PATCH/DELETE /api/tables` + `POST /api/tables/{id}/regenerate-qr`
- `GET /api/tables/qr-pdf` — bulk QR PDF download
- `GET /api/orders?station=&status=&from=&to=`
- `PATCH /api/orders/{id}/status`
- `PATCH /api/orders/{id}/items/{itemId}/status`
- `POST /api/orders/{id}/mark-cash-paid`
- `POST /api/staff/invite`, `PATCH /api/staff/{id}`
- `POST /api/billing/portal`

### Webhooks

- `POST /api/webhooks/stripe` — payment_intent.succeeded, charge.refunded, invoice.paid (subscription)

---

## 11. Order Flow Logic (QR scan → kitchen / bar / cashier)

1. **Scan**: phone opens `/r/{slug}/t/{token}` → server validates token → resolves `(restaurant, table)` → sets short-lived signed cookie `tableSession` with `{restaurantId, tableId, expiresAt}`
2. **Browse**: menu loaded with `is_available=true` items only
3. **Add to cart**: cart in `localStorage`, scoped by tableId — survives reload
4. **Checkout**:
   - Cash → `POST /orders` with `payment_method=cash` → server creates order with `status=received, payment_status=unpaid`
   - Card → `POST /orders` returns `clientSecret` → client confirms with Stripe Payment Element → on success, Stripe webhook flips `payment_status=paid`
5. **Routing**: server splits `order_items` by `station`. Three realtime broadcasts:
   - channel `restaurant:{id}:kitchen` — payload of food items
   - channel `restaurant:{id}:bar` — payload of drink items
   - channel `restaurant:{id}:cashier` — full order
6. **Station boards** subscribe to their channel; new ticket appears with sound; staff updates status; status changes broadcast back so cashier and customer see progress
7. **Completion**: when all `order_items.status = served` and `payment_status=paid`, order auto-flips to `served`

**Edge cases:**

- Network failure mid-checkout → idempotency key on `POST /orders`
- Stripe webhook arrives before client confirms → state machine accepts either order
- Owner archives a table mid-order → existing order finishes; new scans rejected
- Item goes 86'd after add to cart but before pay → server validates availability on submit, returns updated cart with removed line

---

## 12. Payment Flow

### Card (Stripe)

1. Client creates order draft → server creates PaymentIntent: `paymentIntents.create({ amount, currency, transfer_data: { destination: restaurant.stripe_account_id }, application_fee_amount }, { idempotencyKey })`
2. Server returns `{orderId, clientSecret}`
3. Client mounts Stripe Payment Element with `clientSecret`
4. Customer fills name + email + card; Stripe handles 3DS
5. On success, client polls/listens for `payment_status=paid`
6. Stripe webhook updates DB and broadcasts; receipt emailed via Resend
7. Refunds initiated by owner from dashboard → `refunds.create` → webhook updates

**Stripe Connect (Standard accounts):** each restaurant connects their Stripe account; payouts go directly to them; platform takes `application_fee_amount` per transaction. (MVP can use a single platform account; Connect added v2.)

### Cash

1. Client submits order → `payment_status=unpaid`
2. Order routes to stations and cashier
3. When customer pays cash, cashier taps "Mark paid" → `payment_status=paid, paid_at=now`
4. Optional drawer integration via PrintNode

---

## 13. Security Considerations

- **HTTPS** everywhere (HSTS preload)
- **Auth**: email/password with argon2id; rate-limit login; optional TOTP MFA for owners
- **Authorization**: every query scoped by `restaurant_id`; Postgres RLS as safety net
- **Table tokens**: 16-byte URL-safe random; rotatable; rate-limit to prevent enumeration
- **Stripe**: never log full card data; use Payment Element (PCI SAQ A); verify webhook signatures
- **CSRF**: SameSite=Lax cookies, double-submit token for state-changing requests
- **XSS**: React escaping by default; `dangerouslySetInnerHTML` banned by lint rule
- **SQL injection**: Prisma parameterized queries
- **File upload**: validate MIME + magic bytes; resize server-side (sharp); serve from separate domain or signed URL
- **Rate limiting**: Upstash Redis on public endpoints (orders, menu, login)
- **Audit log**: every admin action recorded with who/what/when
- **Backups**: daily Postgres snapshots, 30-day retention; point-in-time recovery
- **Secrets**: Vercel env vars; never in repo; rotate quarterly
- **Dependency scanning**: Dependabot + `npm audit` in CI
- **Privacy**: customer email stored only when card payment; deletable on request

---

## 14. Multi-Tenant SaaS Considerations

- **Isolation model**: shared DB, shared schema, `restaurant_id` discriminator + RLS
- **Tenant resolution**: from URL slug (public pages) or from `memberships` JWT claim (admin)
- **Plans** (suggested):

| Plan    | Price   | Tables    | Orders/mo | Stations                | Connect payouts |
| ------- | ------- | --------- | --------- | ----------------------- | --------------- |
| Starter | €29/mo  | 10        | 500       | 1 (combined)            | No              |
| Pro     | €79/mo  | unlimited | 5,000     | 3 (kitchen/bar/cashier) | Yes             |
| Scale   | €199/mo | unlimited | unlimited | + multi-location        | Yes             |

- **Per-tenant config**: currency, locale, tax, hours, branding (logo, color, favicon)
- **Usage metering**: count orders/month for plan limits; soft-warn before block
- **Custom domain (later)**: CNAME to Vercel, automated cert provisioning
- **Data export**: per-tenant CSV/JSON export from settings (GDPR readiness)
- **Tenant offboarding**: 30-day soft delete, then purge

---

## 15. MVP Scope (8–10 weeks)

**In:**

- Owner signup + single restaurant
- Menu CRUD with up to 3 images per item
- Tables with QR generation + downloadable PDF sheet
- Customer scan → menu → cart → order
- Cash payment + Stripe card payment (single platform Stripe account, no Connect yet)
- Real-time order board for Kitchen, Bar, Cashier (single page, role-filtered)
- Order status updates (received → preparing → ready → served)
- Item availability toggle (in stock / 86'd)
- Optional tax + service charge
- Basic reports (today's revenue, order count, top items)
- Mobile-first PWA
- Email receipts

**Out (v2+):**

- Stripe Connect / per-restaurant payouts
- Modifiers UI (data model ready)
- Multi-language menus
- Hardware printers / KDS displays
- SMS notifications
- Loyalty / coupons
- Multi-location chains
- Reservations / waitlist

---

## 16. Future Advanced Features

- Stripe Connect with per-restaurant payouts and platform fee
- Reservation + waitlist module
- Loyalty program (points, coupons, referrals)
- Tipping flow + split-the-bill
- Multi-language menus (i18n) + auto-translate
- Allergen / dietary filters
- AI-generated item descriptions and food photo enhancement
- Predictive prep times based on history
- Inventory and recipe-cost tracking
- Staff timesheets
- Analytics dashboards (cohort, table turn time)
- Multi-location chain management
- White-label custom domains
- Native iOS/Android wrappers (Capacitor)
- Hardware integrations: thermal printers, KDS displays, cash drawers
- Offline-capable station boards (service worker queue)

---

## 17. Suggested UI/UX Structure

**Design system:** shadcn/ui components, Tailwind tokens, Inter for UI, restaurant brand color injected per tenant.

### Customer (mobile-first)

- Hero header with restaurant logo + "Table 7"
- Sticky horizontal category nav
- Card grid: image, name, price, "+" button
- Item modal: image carousel, description, qty stepper, note textarea, modifiers, "Add — €12.50" CTA
- Sticky cart bar at bottom showing item count + total
- Checkout: large radio cards for Card / Cash, then form
- Order status: timeline with icons (received, preparing, ready, served)

### Owner dashboard (desktop-primary, responsive)

- Sidebar nav, content area
- Live Orders: kanban-style columns, card per order with table number + items + timer
- Menu: list with thumbnails, inline edit, drag handle
- Tables: grid of table cards with QR preview, "Print all QR codes" button
- Reports: charts (Recharts), date picker

### Station boards (tablet-primary)

- Full-screen, large text, single column of tickets
- Each ticket: table number, time elapsed, items with notes, [Start] / [Ready] / [Served] buttons
- Audio cue on new order
- Auto-archive after served

**Accessibility:** WCAG 2.1 AA, semantic HTML, focus rings, keyboard nav, prefers-reduced-motion respected.

---

## 18. Folder Structure

```
restaurant-platform/
├── apps/
│   └── web/                              # Next.js 14 (App Router)
│       ├── app/
│       │   ├── (marketing)/              # public marketing site
│       │   ├── r/[slug]/                 # restaurant public + menu
│       │   │   ├── page.tsx              # restaurant info
│       │   │   └── t/[token]/
│       │   │       ├── page.tsx          # menu
│       │   │       ├── item/[id]/page.tsx
│       │   │       ├── cart/page.tsx
│       │   │       ├── checkout/page.tsx
│       │   │       └── order/[code]/page.tsx
│       │   ├── (admin)/                  # owner dashboard
│       │   │   ├── layout.tsx
│       │   │   ├── orders/page.tsx
│       │   │   ├── menu/page.tsx
│       │   │   ├── tables/page.tsx
│       │   │   ├── staff/page.tsx
│       │   │   ├── reports/page.tsx
│       │   │   └── settings/page.tsx
│       │   ├── (station)/                # kitchen/bar/cashier boards
│       │   │   ├── kitchen/page.tsx
│       │   │   ├── bar/page.tsx
│       │   │   └── cashier/page.tsx
│       │   ├── (auth)/login | signup
│       │   └── api/
│       │       ├── public/...
│       │       ├── orders/...
│       │       ├── items/...
│       │       ├── tables/...
│       │       └── webhooks/stripe/route.ts
│       ├── components/
│       │   ├── ui/                       # shadcn primitives
│       │   ├── customer/
│       │   ├── admin/
│       │   └── station/
│       ├── lib/
│       │   ├── db.ts                     # prisma client
│       │   ├── auth.ts                   # session helpers
│       │   ├── stripe.ts
│       │   ├── qr.ts                     # generateTableQr()
│       │   ├── realtime.ts               # publish/subscribe helpers
│       │   ├── tenant.ts                 # resolveRestaurantFromRequest()
│       │   └── validators/               # zod schemas
│       ├── server/
│       │   ├── orders/
│       │   ├── menu/
│       │   ├── tables/
│       │   └── billing/
│       ├── hooks/
│       ├── styles/
│       ├── public/
│       ├── middleware.ts
│       └── package.json
├── packages/
│   ├── db/                               # prisma schema + migrations
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── shared/                           # shared types, zod schemas
│   └── config/                           # eslint, tsconfig, tailwind
├── docs/
│   └── superpowers/specs/
├── .github/workflows/
├── .env.example
├── docker-compose.yml                    # local postgres
├── package.json
└── pnpm-workspace.yaml
```

---

## 19. Step-by-Step Development Plan

| Wk  | Milestone                  | Deliverable                                                                                    |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Repo + infra               | Monorepo, Next.js, Prisma, Postgres locally, Vercel + Supabase staging, Sentry, GitHub Actions |
| 2   | Auth + tenant              | Owner signup/login, restaurant creation wizard, RLS policies, middleware tenant resolution     |
| 3   | Menu CRUD                  | Categories + items + image upload, admin pages, public menu read                               |
| 4   | Tables + QR                | Tables CRUD, QR generation, downloadable PDF, table-token middleware                           |
| 5   | Cart + cash order          | Customer flow up to "Place order" cash; orders + order_items writes; basic order list in admin |
| 6   | Stripe + webhooks          | Payment Element integration, webhook handler, receipts via Resend                              |
| 7   | Real-time + station boards | Realtime channels, kitchen/bar/cashier boards, status updates                                  |
| 8   | Polish + reports           | Daily revenue/orders chart, item availability toggle, mobile QA, accessibility pass            |
| 9   | Beta with 1 restaurant     | Onboarding 1 pilot restaurant, observability, bugfixes                                         |
| 10  | Launch readiness           | Pricing/billing, marketing site, docs, public launch                                           |

---

## 20. Starter Code Architecture

### `packages/db/schema.prisma` (excerpt)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role { owner manager kitchen bar cashier }
enum Station { kitchen bar both }
enum OrderStatus { received preparing ready served cancelled }
enum PaymentMethod { card cash }
enum PaymentStatus { unpaid paid refunded }

model Restaurant {
  id                 String   @id @default(cuid())
  slug               String   @unique
  name               String
  currency           String   @default("EUR")
  taxRate            Decimal  @default(0)
  serviceChargePct   Decimal  @default(0)
  stripeAccountId    String?
  createdAt          DateTime @default(now())
  tables             Table[]
  categories         Category[]
  menuItems          MenuItem[]
  orders             Order[]
  memberships        Membership[]
}

model User {
  id           String       @id @default(cuid())
  email        String       @unique
  passwordHash String
  name         String?
  createdAt    DateTime     @default(now())
  memberships  Membership[]
}

model Membership {
  id           String     @id @default(cuid())
  user         User       @relation(fields: [userId], references: [id])
  userId       String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  restaurantId String
  role         Role
  @@unique([userId, restaurantId])
}

model Table {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  number       Int
  label        String?
  token        String     @unique
  isActive     Boolean    @default(true)
  orders       Order[]
  @@unique([restaurantId, number])
}

model Category {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  name         String
  sortOrder    Int        @default(0)
  isActive     Boolean    @default(true)
  items        MenuItem[]
}

model MenuItem {
  id           String          @id @default(cuid())
  restaurantId String
  restaurant   Restaurant      @relation(fields: [restaurantId], references: [id])
  categoryId   String
  category     Category        @relation(fields: [categoryId], references: [id])
  name         String
  description  String?
  priceCents   Int
  station      Station
  isAvailable  Boolean         @default(true)
  sortOrder    Int             @default(0)
  images       MenuItemImage[]
}

model MenuItemImage {
  id         String   @id @default(cuid())
  menuItemId String
  menuItem   MenuItem @relation(fields: [menuItemId], references: [id])
  url        String
  sortOrder  Int      @default(0)
}

model Order {
  id                    String        @id @default(cuid())
  code                  String        @unique
  restaurantId          String
  restaurant            Restaurant    @relation(fields: [restaurantId], references: [id])
  tableId               String
  table                 Table         @relation(fields: [tableId], references: [id])
  status                OrderStatus   @default(received)
  paymentMethod         PaymentMethod
  paymentStatus         PaymentStatus @default(unpaid)
  customerName          String?
  customerEmail         String?
  subtotalCents         Int
  taxCents              Int
  serviceCents          Int
  totalCents            Int
  stripePaymentIntentId String?       @unique
  notes                 String?
  createdAt             DateTime      @default(now())
  paidAt                DateTime?
  items                 OrderItem[]
}

model OrderItem {
  id             String      @id @default(cuid())
  orderId        String
  order          Order       @relation(fields: [orderId], references: [id])
  menuItemId     String
  nameSnapshot   String
  station        Station
  qty            Int
  unitPriceCents Int
  lineTotalCents Int
  note           String?
  status         OrderStatus @default(received)
}
```

### `lib/qr.ts`

```ts
import QRCode from "qrcode";
import crypto from "crypto";

export function generateTableToken(): string {
  return crypto.randomBytes(12).toString("base64url"); // ~16 chars, URL-safe
}

export async function renderQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { type: "png", width: 1024, margin: 2 });
}

export function buildTableUrl(slug: string, token: string): string {
  return `${process.env.PUBLIC_BASE_URL}/r/${slug}/t/${token}`;
}
```

### `lib/tenant.ts`

```ts
import { cookies } from "next/headers";
import { prisma } from "./db";

const COOKIE = "tableSession";

export async function resolveTableSession() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const table = await prisma.table.findUnique({
    where: { token },
    include: { restaurant: true },
  });
  return table?.isActive ? table : null;
}

export function setTableCookie(token: string) {
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 4, // 4-hour dining session
    path: "/",
  });
}
```

### `app/api/public/orders/route.ts`

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveTableSession } from "@/lib/tenant";
import { stripe } from "@/lib/stripe";
import { broadcastNewOrder } from "@/lib/realtime";
import { computeTotals } from "@/server/orders/totals";
import { generateOrderCode } from "@/server/orders/code";

const Body = z.object({
  paymentMethod: z.enum(["card", "cash"]),
  customerName: z.string().min(1).optional(),
  customerEmail: z.string().email().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        qty: z.number().int().positive(),
        note: z.string().max(200).optional(),
      }),
    )
    .min(1),
  idempotencyKey: z.string().uuid(),
});

export async function POST(req: Request) {
  const table = await resolveTableSession();
  if (!table) return new Response("invalid table", { status: 401 });

  const body = Body.parse(await req.json());

  if (body.paymentMethod === "card" && (!body.customerName || !body.customerEmail))
    return new Response("name+email required for card", { status: 400 });

  const items = await prisma.menuItem.findMany({
    where: {
      id: { in: body.items.map((i) => i.menuItemId) },
      restaurantId: table.restaurantId,
      isAvailable: true,
    },
  });

  const totals = computeTotals(items, body.items, table.restaurant);

  const order = await prisma.order.create({
    data: {
      code: generateOrderCode(),
      restaurantId: table.restaurantId,
      tableId: table.id,
      paymentMethod: body.paymentMethod,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      serviceCents: totals.serviceCents,
      totalCents: totals.totalCents,
      items: { create: totals.lines },
    },
    include: { items: true },
  });

  let clientSecret: string | undefined;
  if (body.paymentMethod === "card") {
    const pi = await stripe.paymentIntents.create(
      {
        amount: totals.totalCents,
        currency: table.restaurant.currency.toLowerCase(),
        metadata: { orderId: order.id, restaurantId: table.restaurantId },
        receipt_email: body.customerEmail,
      },
      { idempotencyKey: body.idempotencyKey },
    );
    clientSecret = pi.client_secret!;
    await prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: pi.id },
    });
  }

  await broadcastNewOrder(order);
  return Response.json({ orderCode: order.code, clientSecret });
}
```

### `app/api/webhooks/stripe/route.ts`

```ts
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { broadcastOrderUpdate } from "@/lib/realtime";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature")!;
  const buf = await req.arrayBuffer();
  const event = stripe.webhooks.constructEvent(
    Buffer.from(buf),
    sig,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const order = await prisma.order.update({
      where: { stripePaymentIntentId: pi.id },
      data: { paymentStatus: "paid", paidAt: new Date() },
      include: { items: true },
    });
    await broadcastOrderUpdate(order);
  }
  return new Response("ok");
}
```

### `lib/realtime.ts` (Supabase Realtime)

```ts
import { createClient } from "@supabase/supabase-js";

const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function broadcastNewOrder(order: any) {
  const r = order.restaurantId;
  const kitchen = order.items.filter((i: any) => i.station !== "bar");
  const bar = order.items.filter((i: any) => i.station !== "kitchen");

  await Promise.all([
    supa.channel(`restaurant:${r}:kitchen`).send({
      type: "broadcast",
      event: "order.new",
      payload: { orderCode: order.code, tableId: order.tableId, items: kitchen },
    }),
    supa.channel(`restaurant:${r}:bar`).send({
      type: "broadcast",
      event: "order.new",
      payload: { orderCode: order.code, tableId: order.tableId, items: bar },
    }),
    supa.channel(`restaurant:${r}:cashier`).send({
      type: "broadcast",
      event: "order.new",
      payload: order,
    }),
  ]);
}

export async function broadcastOrderUpdate(order: any) {
  await supa.channel(`restaurant:${order.restaurantId}:cashier`).send({
    type: "broadcast",
    event: "order.update",
    payload: order,
  });
}
```

### `middleware.ts` (table token capture)

```ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const m = req.nextUrl.pathname.match(/^\/r\/[^/]+\/t\/([^/]+)/);
  if (m) {
    const res = NextResponse.next();
    res.cookies.set("tableSession", m[1], {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 4,
      path: "/",
    });
    return res;
  }
  return NextResponse.next();
}

export const config = { matcher: ["/r/:path*"] };
```

---

## Open Questions / Assumptions to Confirm

1. **Hosting region** — assumed Vercel + Supabase in EU (Frankfurt) given user is in Greece. Confirm.
2. **Multi-language** — out of MVP scope; Greek + English in v2 likely. Confirm.
3. **Stripe Connect** — deferred to v2; MVP uses platform Stripe account. Confirm.
4. **Self-service vs invite-only beta** — recommend invite-only beta for first 5 restaurants, then open signup.
5. **Modifiers** — data model ready, UI deferred to v2. Confirm.
6. **Tipping** — out of MVP. Confirm.
7. **Hardware printers** — deferred; browser print only in MVP.
