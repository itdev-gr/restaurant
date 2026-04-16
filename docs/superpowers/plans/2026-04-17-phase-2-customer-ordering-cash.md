# Restaurant Platform — Phase 2: Customer Ordering + Cash Payment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Diner scans QR → `/r/{slug}/t/{token}` → browses menu → adds items to cart with notes → checks out with cash → sees order status. Owner sees incoming orders at `/orders` (polled; real-time in Phase 4).

**Architecture:** Customer routes are public (anonymous). The `/r/{slug}/t/{token}` route validates the token and sets a signed HTTPOnly cookie `tableSession` containing `{restaurantId, tableId, exp}`. Subsequent customer-facing routes (`/r/*`) read this cookie to scope queries. Cart lives in `localStorage` keyed by `tableId`. Order submission is a server action with an idempotency key to prevent duplicate submits on retry.

**Tech Stack additions:** `jose` (signed JWT cookies) — or reuse Next.js cookie signing via `crypto.createHmac` for a tiny, lock-in-free dependency. No Stripe yet (Phase 3). No real-time yet (Phase 4).

**Out of scope:** Stripe card payment, real-time station boards, modifiers UI, RLS, drag-reorder.

---

## File Structure (Phase 2 additions)

```
apps/web/
├── app/
│   ├── r/[slug]/t/[token]/
│   │   ├── layout.tsx                     # customer layout (mobile-first; no admin shell)
│   │   ├── page.tsx                       # menu home (categories + items)
│   │   ├── cart/page.tsx                  # cart review
│   │   ├── checkout/page.tsx              # payment method selection (cash only Phase 2)
│   │   └── order/[code]/page.tsx          # order status
│   └── (admin)/orders/page.tsx            # admin orders list
├── components/
│   ├── customer/
│   │   ├── menu-categories.tsx            # category tabs (sticky)
│   │   ├── menu-item-list.tsx             # items grid for active category
│   │   ├── item-sheet.tsx                 # bottom sheet with qty + note + add-to-cart (client)
│   │   ├── cart-bar.tsx                   # sticky footer with item count + total
│   │   ├── cart-list.tsx                  # cart contents
│   │   └── order-status.tsx               # status timeline
│   └── admin/
│       └── orders-list.tsx                # incoming orders table
├── lib/
│   ├── table-session.ts                   # signTableCookie, verifyTableCookie, COOKIE_NAME
│   ├── cart.ts                            # LocalCartStorage helpers (client)
│   └── order-code.ts                      # generateOrderCode()
├── server/
│   ├── services/
│   │   ├── table-session.ts               # resolveTableFromToken(token)
│   │   └── order.ts                       # createOrder, getOrderByCode, listOrdersForRestaurant
│   └── actions/
│       ├── table-session.ts               # setTableSessionAction (bootstraps cookie)
│       └── order.ts                       # submitOrderAction, markOrderPaidAction
└── __tests__/
    ├── lib/table-session.test.ts
    ├── lib/order-code.test.ts
    ├── server/services/table-session.test.ts
    └── server/services/order.test.ts

packages/db/prisma/
└── migrations/<timestamp>_orders/migration.sql

packages/shared/src/zod/
└── order.ts                               # CartLineInput, CreateOrderInput
```

---

## Conventions Reinforced

- Customer routes NEVER call `requireMembership()` or `requireRestaurant()` — they use `resolveTableSession()` which reads the signed cookie.
- Services remain pure: take IDs + input, return `ActionResult<T>`, no auth/session reads.
- Order submission is idempotent: pass a client-generated UUIDv4 → server dedupes via `(restaurantId, idempotencyKey)` unique index.
- Money in cents. Tax and service are computed on the server from restaurant settings at order time and stored as absolute cent values on the order.

---

## Tasks

### Task 1: Extend schema — Order, OrderItem, enums + idempotency index

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Generated migration: `packages/db/prisma/migrations/<timestamp>_orders/`
- Modify: `apps/web/lib/db.ts` (re-exports — no change needed if Prisma types auto-flow)

- [ ] **Step 1: Append to `schema.prisma`**

```prisma
enum OrderStatus {
  received
  preparing
  ready
  served
  cancelled
}

enum OrderItemStatus {
  received
  preparing
  ready
  served
}

enum PaymentMethod {
  card
  cash
}

enum PaymentStatus {
  unpaid
  paid
  refunded
}

model Order {
  id                    String         @id @default(cuid())
  code                  String
  restaurantId          String
  restaurant            Restaurant     @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  tableId               String
  table                 Table          @relation(fields: [tableId], references: [id], onDelete: Cascade)
  status                OrderStatus    @default(received)
  paymentMethod         PaymentMethod
  paymentStatus         PaymentStatus  @default(unpaid)
  customerName          String?
  customerEmail         String?
  subtotalCents         Int
  taxCents              Int
  serviceCents          Int
  totalCents            Int
  stripePaymentIntentId String?        @unique
  notes                 String?
  idempotencyKey        String
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt
  paidAt                DateTime?
  items                 OrderItem[]

  @@unique([restaurantId, code])
  @@unique([restaurantId, idempotencyKey])
  @@index([restaurantId, status, createdAt])
  @@index([tableId, status])
}

model OrderItem {
  id             String           @id @default(cuid())
  orderId        String
  order          Order            @relation(fields: [orderId], references: [id], onDelete: Cascade)
  menuItemId     String
  menuItem       MenuItem         @relation(fields: [menuItemId], references: [id])
  nameSnapshot   String
  station        Station
  qty            Int
  unitPriceCents Int
  lineTotalCents Int
  note           String?
  status         OrderItemStatus  @default(received)
  createdAt      DateTime         @default(now())

  @@index([orderId])
}
```

Also add backrefs inside existing models:

- `Restaurant { ...; orders Order[] }`
- `Table { ...; orders Order[] }`
- `MenuItem { ...; orderItems OrderItem[] }`

- [ ] **Step 2: Generate migration**

```bash
cd /Users/marios/Desktop/Cursor/restaurant
pnpm -F @app/db exec prisma migrate dev --name orders
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(db): add Order, OrderItem, payment/order enums"
```

---

### Task 2: Shared zod schemas for order

**Files:**
- Create: `packages/shared/src/zod/order.ts`
- Modify: `packages/shared/src/index.ts`, `packages/shared/package.json` (export subpath)

- [ ] **Step 1: Create `packages/shared/src/zod/order.ts`**

```ts
import { z } from "zod";

export const PAYMENT_METHODS = ["card", "cash"] as const;
export const PaymentMethodSchema = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const CartLineInput = z.object({
  menuItemId: z.string(),
  qty: z.number().int().min(1).max(99),
  note: z.string().trim().max(200).optional(),
});
export type CartLineInput = z.infer<typeof CartLineInput>;

export const CreateOrderInput = z.object({
  paymentMethod: PaymentMethodSchema,
  customerName: z.string().trim().min(1).max(80).optional(),
  customerEmail: z.string().trim().toLowerCase().email().optional(),
  notes: z.string().trim().max(500).optional(),
  items: z.array(CartLineInput).min(1).max(50),
  idempotencyKey: z.string().uuid(),
}).refine(
  (v) => v.paymentMethod !== "card" || (v.customerName && v.customerEmail),
  { message: "Card payment requires name and email.", path: ["paymentMethod"] },
);
export type CreateOrderInput = z.infer<typeof CreateOrderInput>;
```

- [ ] **Step 2: Update `packages/shared/src/index.ts`** — add `export * from "./zod/order.js";`

- [ ] **Step 3: Update `packages/shared/package.json`** — add `"./zod/order": "./src/zod/order.ts"` to `exports`

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(shared): zod schemas for cart and order"
```

---

### Task 3: Table session (signed cookie) with TDD

**Files:**
- Create: `apps/web/lib/table-session.ts`
- Create: `apps/web/__tests__/lib/table-session.test.ts`
- Create: `apps/web/server/services/table-session.ts`
- Create: `apps/web/__tests__/server/services/table-session.test.ts`

The signed cookie uses `crypto.createHmac` — no external deps. Payload: `{rid, tid, exp}` → JSON → HMAC-SHA256 signed with `NEXTAUTH_SECRET` (reuse existing env var). Token format: `<base64url(payload)>.<base64url(sig)>`.

- [ ] **Step 1: Write failing test `apps/web/__tests__/lib/table-session.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";

vi.stubEnv("NEXTAUTH_SECRET", "test-secret-for-table-session-test-very-long");

import { signTableCookie, verifyTableCookie } from "@/lib/table-session";

describe("table-session cookie", () => {
  it("round-trips a payload", () => {
    const payload = { rid: "r1", tid: "t1", exp: Date.now() + 60_000 };
    const token = signTableCookie(payload);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const parsed = verifyTableCookie(token);
    expect(parsed).toEqual(payload);
  });

  it("rejects a tampered token", () => {
    const payload = { rid: "r1", tid: "t1", exp: Date.now() + 60_000 };
    const token = signTableCookie(payload);
    const [body] = token.split(".");
    const tampered = body + ".invalidsig";
    expect(verifyTableCookie(tampered)).toBeNull();
  });

  it("rejects an expired token", () => {
    const payload = { rid: "r1", tid: "t1", exp: Date.now() - 1_000 };
    const token = signTableCookie(payload);
    expect(verifyTableCookie(token)).toBeNull();
  });
});
```

- [ ] **Step 2: Implement `apps/web/lib/table-session.ts`**

```ts
import crypto from "node:crypto";

export const TABLE_COOKIE = "tableSession";
export const TABLE_COOKIE_MAX_AGE_SEC = 60 * 60 * 4; // 4 hours

export type TableCookiePayload = { rid: string; tid: string; exp: number };

function secret(): Buffer {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET required for table session signing.");
  return Buffer.from(s);
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function hmac(body: string): string {
  return b64url(crypto.createHmac("sha256", secret()).update(body).digest());
}

export function signTableCookie(payload: TableCookiePayload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${hmac(body)}`;
}

export function verifyTableCookie(token: string | undefined | null): TableCookiePayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = hmac(body);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TableCookiePayload;
    if (!payload.rid || !payload.tid || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Run lib test — expect PASS**

- [ ] **Step 4: Write failing service test `apps/web/__tests__/server/services/table-session.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "../../_helpers/db";
import { resetSupabaseAuthUsers } from "../../_helpers/supabase";
import { bulkCreateTables } from "@/server/services/table";
import { resolveTableFromToken } from "@/server/services/table-session";

async function seedWithTable(slug = "r") {
  const r = await prisma.restaurant.create({
    data: { slug: `${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: "R", currency: "EUR" },
    select: { id: true, slug: true },
  });
  await bulkCreateTables(r.id, { count: 1 });
  const t = await prisma.table.findFirstOrThrow({ where: { restaurantId: r.id } });
  return { restaurant: r, table: t };
}

describe("resolveTableFromToken", () => {
  beforeEach(async () => {
    await resetDb();
    await resetSupabaseAuthUsers();
  });

  it("resolves a valid slug+token to restaurant + table", async () => {
    const { restaurant, table } = await seedWithTable();
    const r = await resolveTableFromToken(restaurant.slug, table.token);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.restaurantId).toBe(restaurant.id);
    expect(r.data.tableId).toBe(table.id);
    expect(r.data.restaurant.slug).toBe(restaurant.slug);
  });

  it("returns NOT_FOUND if slug wrong", async () => {
    const { table } = await seedWithTable();
    const r = await resolveTableFromToken("wrong-slug", table.token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("returns NOT_FOUND if token doesn't match restaurant", async () => {
    const a = await seedWithTable("a");
    const b = await seedWithTable("b");
    const r = await resolveTableFromToken(a.restaurant.slug, b.table.token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("returns ARCHIVED if table is archived", async () => {
    const { restaurant, table } = await seedWithTable();
    await prisma.table.update({ where: { id: table.id }, data: { isArchived: true } });
    const r = await resolveTableFromToken(restaurant.slug, table.token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("ARCHIVED");
  });
});
```

- [ ] **Step 5: Implement `apps/web/server/services/table-session.ts`**

```ts
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/server/actions/auth";

type Resolved = {
  restaurantId: string;
  tableId: string;
  restaurant: { id: string; slug: string; name: string; currency: string; taxRate: string; serviceChargePct: string };
  table: { id: string; number: number; label: string | null };
};

export async function resolveTableFromToken(
  slug: string,
  token: string,
): Promise<ActionResult<Resolved>> {
  const table = await prisma.table.findUnique({
    where: { token },
    include: { restaurant: { select: { id: true, slug: true, name: true, currency: true, taxRate: true, serviceChargePct: true } } },
  });
  if (!table || table.restaurant.slug !== slug) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Table not found." } };
  }
  if (table.isArchived) {
    return { ok: false, error: { code: "ARCHIVED", message: "This table is no longer active." } };
  }
  return {
    ok: true,
    data: {
      restaurantId: table.restaurantId,
      tableId: table.id,
      restaurant: {
        id: table.restaurant.id,
        slug: table.restaurant.slug,
        name: table.restaurant.name,
        currency: table.restaurant.currency,
        taxRate: table.restaurant.taxRate.toString(),
        serviceChargePct: table.restaurant.serviceChargePct.toString(),
      },
      table: { id: table.id, number: table.number, label: table.label },
    },
  };
}
```

- [ ] **Step 6: Run both test files — expect PASS**

- [ ] **Step 7: Commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): table session cookie + resolver with TDD"
```

---

### Task 4: Order code generator with TDD

**Files:**
- Create: `apps/web/lib/order-code.ts`
- Create: `apps/web/__tests__/lib/order-code.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { generateOrderCode, ORDER_CODE_REGEX } from "@/lib/order-code";

describe("order-code", () => {
  it("returns a code matching LETTER + 3 digits", () => {
    for (let i = 0; i < 50; i++) {
      const c = generateOrderCode();
      expect(c).toMatch(ORDER_CODE_REGEX);
    }
  });

  it("produces different codes across invocations", () => {
    const set = new Set(Array.from({ length: 100 }, () => generateOrderCode()));
    expect(set.size).toBeGreaterThan(50);
  });
});
```

- [ ] **Step 2: Implement `apps/web/lib/order-code.ts`**

```ts
import crypto from "node:crypto";

export const ORDER_CODE_REGEX = /^[A-Z][0-9]{3}$/;

export function generateOrderCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // drop I and O
  const l = letters[crypto.randomInt(0, letters.length)]!;
  const n = String(crypto.randomInt(0, 1000)).padStart(3, "0");
  return `${l}${n}`;
}
```

- [ ] **Step 3: Run, verify PASS + commit**

```bash
pnpm -F @app/web test order-code
git add -A && git commit -m "feat(web): order code generator (letter + 3 digits)"
```

---

### Task 5: Order service with TDD (create, totals, idempotency)

**Files:**
- Create: `apps/web/server/services/order.ts`
- Create: `apps/web/__tests__/server/services/order.test.ts`

Behavior:
- Validate with `CreateOrderInput`
- Load menu items by id restricted to restaurant; fail NOT_FOUND if any line references unknown/archived/unavailable items
- Compute subtotal from `unitPriceCents * qty`
- Compute tax = round(subtotal * taxRate / 100); service = round(subtotal * serviceChargePct / 100); total = subtotal + tax + service
- Generate unique order code with retry on collision (`@@unique([restaurantId, code])`)
- Insert Order + OrderItem rows atomically
- Idempotency: if `(restaurantId, idempotencyKey)` already exists, return the existing order's code (200 OK, not 409)

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "../../_helpers/db";
import { resetSupabaseAuthUsers } from "../../_helpers/supabase";
import { createCategory } from "@/server/services/category";
import { createItem } from "@/server/services/menu-item";
import { bulkCreateTables } from "@/server/services/table";
import { createOrder } from "@/server/services/order";

async function seedOrderContext() {
  const r = await prisma.restaurant.create({
    data: { slug: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: "R", currency: "EUR", taxRate: 13, serviceChargePct: 10 },
    select: { id: true },
  });
  const cat = await createCategory(r.id, { name: "Starters" });
  if (!cat.ok) throw new Error();
  const itemA = await createItem(r.id, { categoryId: cat.data.id, name: "A", priceCents: 500, station: "kitchen" });
  const itemB = await createItem(r.id, { categoryId: cat.data.id, name: "B", priceCents: 300, station: "bar" });
  if (!itemA.ok || !itemB.ok) throw new Error();
  await bulkCreateTables(r.id, { count: 1 });
  const table = await prisma.table.findFirstOrThrow({ where: { restaurantId: r.id } });
  return { restaurantId: r.id, tableId: table.id, itemA: itemA.data.id, itemB: itemB.data.id };
}

function uuid() {
  return "00000000-0000-0000-0000-" + Math.random().toString(16).slice(2, 14).padEnd(12, "0");
}

describe("createOrder", () => {
  beforeEach(async () => {
    await resetDb();
    await resetSupabaseAuthUsers();
  });

  it("computes subtotal, tax (13%), service (10%) and total", async () => {
    const { restaurantId, tableId, itemA, itemB } = await seedOrderContext();
    const r = await createOrder(restaurantId, tableId, {
      paymentMethod: "cash",
      items: [
        { menuItemId: itemA, qty: 2 }, // 1000
        { menuItemId: itemB, qty: 1 }, // 300
      ],
      idempotencyKey: uuid(),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const row = await prisma.order.findUniqueOrThrow({ where: { id: r.data.id } });
    expect(row.subtotalCents).toBe(1300);
    expect(row.taxCents).toBe(169); // 13% of 1300
    expect(row.serviceCents).toBe(130); // 10% of 1300
    expect(row.totalCents).toBe(1599);
    expect(row.paymentMethod).toBe("cash");
    expect(row.status).toBe("received");
    expect(row.paymentStatus).toBe("unpaid");
    expect(row.code).toMatch(/^[A-Z][0-9]{3}$/);
  });

  it("snapshots item name + station + unit price into order items", async () => {
    const { restaurantId, tableId, itemA } = await seedOrderContext();
    const r = await createOrder(restaurantId, tableId, {
      paymentMethod: "cash",
      items: [{ menuItemId: itemA, qty: 3, note: "no onions" }],
      idempotencyKey: uuid(),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const items = await prisma.orderItem.findMany({ where: { orderId: r.data.id } });
    expect(items).toHaveLength(1);
    expect(items[0]!.nameSnapshot).toBe("A");
    expect(items[0]!.station).toBe("kitchen");
    expect(items[0]!.unitPriceCents).toBe(500);
    expect(items[0]!.lineTotalCents).toBe(1500);
    expect(items[0]!.note).toBe("no onions");
  });

  it("is idempotent — same key returns the same order", async () => {
    const { restaurantId, tableId, itemA } = await seedOrderContext();
    const key = uuid();
    const r1 = await createOrder(restaurantId, tableId, {
      paymentMethod: "cash",
      items: [{ menuItemId: itemA, qty: 1 }],
      idempotencyKey: key,
    });
    const r2 = await createOrder(restaurantId, tableId, {
      paymentMethod: "cash",
      items: [{ menuItemId: itemA, qty: 1 }],
      idempotencyKey: key,
    });
    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r2.data.id).toBe(r1.data.id);
    expect(await prisma.order.count()).toBe(1);
  });

  it("rejects items that don't belong to the restaurant", async () => {
    const a = await seedOrderContext();
    const b = await seedOrderContext();
    const r = await createOrder(a.restaurantId, a.tableId, {
      paymentMethod: "cash",
      items: [{ menuItemId: b.itemA, qty: 1 }],
      idempotencyKey: uuid(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("rejects empty cart via zod VALIDATION", async () => {
    const { restaurantId, tableId } = await seedOrderContext();
    const r = await createOrder(restaurantId, tableId, {
      paymentMethod: "cash",
      items: [],
      idempotencyKey: uuid(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION");
  });

  it("rejects card without customer name+email", async () => {
    const { restaurantId, tableId, itemA } = await seedOrderContext();
    const r = await createOrder(restaurantId, tableId, {
      paymentMethod: "card",
      items: [{ menuItemId: itemA, qty: 1 }],
      idempotencyKey: uuid(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION");
  });
});
```

- [ ] **Step 2: Implement `apps/web/server/services/order.ts`**

```ts
import { Prisma } from "@app/db";
import { prisma } from "@/lib/db";
import { CreateOrderInput } from "@app/shared/zod/order";
import type { ActionResult } from "@/server/actions/auth";
import { generateOrderCode } from "@/lib/order-code";

const MAX_CODE_ATTEMPTS = 8;

function validationError(err: { issues: { path: (string | number)[]; message: string }[] }) {
  return {
    ok: false as const,
    error: {
      code: "VALIDATION",
      message: "Invalid input.",
      fields: Object.fromEntries(err.issues.map((i) => [i.path.join("."), i.message])),
    },
  };
}

export async function createOrder(
  restaurantId: string,
  tableId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string; code: string }>> {
  const parsed = CreateOrderInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;

  // Idempotency short-circuit
  const existing = await prisma.order.findUnique({
    where: { restaurantId_idempotencyKey: { restaurantId, idempotencyKey: input.idempotencyKey } },
    select: { id: true, code: true },
  });
  if (existing) return { ok: true, data: existing };

  // Load items restricted to this tenant
  const itemIds = input.items.map((l) => l.menuItemId);
  const items = await prisma.menuItem.findMany({
    where: { id: { in: itemIds }, restaurantId, isArchived: false, isAvailable: true },
    select: { id: true, name: true, priceCents: true, station: true },
  });
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const line of input.items) {
    if (!byId.has(line.menuItemId)) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Some items are not available." } };
    }
  }

  // Fetch tax/service from restaurant
  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    select: { taxRate: true, serviceChargePct: true },
  });

  const subtotalCents = input.items.reduce((sum, line) => {
    const it = byId.get(line.menuItemId)!;
    return sum + it.priceCents * line.qty;
  }, 0);

  const taxCents = Math.round(subtotalCents * Number(restaurant.taxRate) / 100);
  const serviceCents = Math.round(subtotalCents * Number(restaurant.serviceChargePct) / 100);
  const totalCents = subtotalCents + taxCents + serviceCents;

  // Retry on code collision (very rare)
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateOrderCode();
    try {
      const order = await prisma.order.create({
        data: {
          code,
          restaurantId,
          tableId,
          paymentMethod: input.paymentMethod,
          customerName: input.customerName ?? null,
          customerEmail: input.customerEmail ?? null,
          notes: input.notes ?? null,
          idempotencyKey: input.idempotencyKey,
          subtotalCents, taxCents, serviceCents, totalCents,
          items: {
            create: input.items.map((line) => {
              const it = byId.get(line.menuItemId)!;
              return {
                menuItemId: it.id,
                nameSnapshot: it.name,
                station: it.station,
                qty: line.qty,
                unitPriceCents: it.priceCents,
                lineTotalCents: it.priceCents * line.qty,
                note: line.note ?? null,
              };
            }),
          },
        },
        select: { id: true, code: true },
      });
      return { ok: true, data: order };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        // Unique-constraint collision. If it's on idempotencyKey, re-read.
        const target = (e.meta?.target as string[] | undefined) ?? [];
        if (target.includes("idempotencyKey")) {
          const row = await prisma.order.findUnique({
            where: { restaurantId_idempotencyKey: { restaurantId, idempotencyKey: input.idempotencyKey } },
            select: { id: true, code: true },
          });
          if (row) return { ok: true, data: row };
        }
        // else — code collision, try again
        continue;
      }
      throw e;
    }
  }
  return { ok: false, error: { code: "CODE_CONFLICT", message: "Could not allocate order code." } };
}

export async function getOrderByCode(restaurantId: string, code: string) {
  return prisma.order.findUnique({
    where: { restaurantId_code: { restaurantId, code } },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      table: { select: { number: true, label: true } },
    },
  });
}

export async function listOrdersForRestaurant(restaurantId: string, opts: { status?: "received" | "preparing" | "ready" | "served" | "cancelled" } = {}) {
  return prisma.order.findMany({
    where: { restaurantId, ...(opts.status ? { status: opts.status } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      table: { select: { number: true, label: true } },
    },
    take: 100,
  });
}
```

- [ ] **Step 3: Run, verify PASS + commit**

```bash
pnpm -F @app/web test order
git add -A && git commit -m "feat(web): order service with TDD — totals, snapshots, idempotency, code retry"
```

---

### Task 6: Customer menu page + table session bootstrap

**Files:**
- Create: `apps/web/app/r/[slug]/t/[token]/layout.tsx`, `page.tsx`
- Create: `apps/web/components/customer/menu-categories.tsx`, `menu-item-list.tsx`, `cart-bar.tsx`
- Create: `apps/web/lib/cart.ts` (client helpers)
- Create: `apps/web/server/actions/table-session.ts`

The layout is intentionally minimal — no admin sidebar/topbar. Mobile-first. The page validates the token via `resolveTableFromToken`, sets the cookie via a server action invoked on first load, then renders the menu.

- [ ] **Step 1: Create `apps/web/app/r/[slug]/t/[token]/layout.tsx`**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Order" };

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white">{children}</div>;
}
```

- [ ] **Step 2: Create `apps/web/server/actions/table-session.ts`**

```ts
"use server";

import { cookies } from "next/headers";
import {
  TABLE_COOKIE,
  TABLE_COOKIE_MAX_AGE_SEC,
  signTableCookie,
} from "@/lib/table-session";

export async function setTableSessionAction(restaurantId: string, tableId: string) {
  const exp = Date.now() + TABLE_COOKIE_MAX_AGE_SEC * 1000;
  const token = signTableCookie({ rid: restaurantId, tid: tableId, exp });
  cookies().set(TABLE_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: "lax",
    maxAge: TABLE_COOKIE_MAX_AGE_SEC, path: "/r",
  });
}
```

- [ ] **Step 3: Create `apps/web/app/r/[slug]/t/[token]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { resolveTableFromToken } from "@/server/services/table-session";
import { setTableSessionAction } from "@/server/actions/table-session";
import { listCategories } from "@/server/services/category";
import { listItems } from "@/server/services/menu-item";
import { MenuCategories } from "@/components/customer/menu-categories";
import { MenuItemList } from "@/components/customer/menu-item-list";
import { CartBar } from "@/components/customer/cart-bar";

export const dynamic = "force-dynamic";

export default async function CustomerMenuPage({
  params, searchParams,
}: {
  params: { slug: string; token: string };
  searchParams: { category?: string };
}) {
  const resolved = await resolveTableFromToken(params.slug, params.token);
  if (!resolved.ok) notFound();
  await setTableSessionAction(resolved.data.restaurantId, resolved.data.tableId);

  const categories = await listCategories(resolved.data.restaurantId);
  const activeId = searchParams.category ?? categories[0]?.id ?? null;
  const items = activeId ? await listItems(resolved.data.restaurantId, { categoryId: activeId }) : [];

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Table {resolved.data.table.label ?? resolved.data.table.number}
        </div>
        <h1 className="text-lg font-semibold">{resolved.data.restaurant.name}</h1>
      </header>
      <MenuCategories slug={params.slug} token={params.token} categories={categories} activeId={activeId} />
      <main className="px-4 pb-24 pt-4">
        <MenuItemList
          items={items.filter((i) => i.isAvailable)}
          slug={params.slug}
          token={params.token}
          currency={resolved.data.restaurant.currency}
        />
      </main>
      <CartBar slug={params.slug} token={params.token} tableId={resolved.data.tableId} currency={resolved.data.restaurant.currency} />
    </>
  );
}
```

- [ ] **Step 4: Create `apps/web/lib/cart.ts`**

```ts
"use client";

export type CartLine = { menuItemId: string; name: string; priceCents: number; qty: number; note?: string };
export type Cart = { tableId: string; lines: CartLine[] };

const KEY = (tableId: string) => `cart_${tableId}`;

export function readCart(tableId: string): Cart {
  if (typeof window === "undefined") return { tableId, lines: [] };
  try {
    const raw = window.localStorage.getItem(KEY(tableId));
    if (!raw) return { tableId, lines: [] };
    return JSON.parse(raw) as Cart;
  } catch {
    return { tableId, lines: [] };
  }
}

export function writeCart(cart: Cart) {
  window.localStorage.setItem(KEY(cart.tableId), JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent("cart-change"));
}

export function addLine(tableId: string, line: CartLine) {
  const cart = readCart(tableId);
  cart.lines.push(line);
  writeCart(cart);
}

export function updateLine(tableId: string, index: number, partial: Partial<CartLine>) {
  const cart = readCart(tableId);
  if (!cart.lines[index]) return;
  cart.lines[index] = { ...cart.lines[index], ...partial };
  if (cart.lines[index].qty <= 0) cart.lines.splice(index, 1);
  writeCart(cart);
}

export function removeLine(tableId: string, index: number) {
  const cart = readCart(tableId);
  cart.lines.splice(index, 1);
  writeCart(cart);
}

export function clearCart(tableId: string) {
  writeCart({ tableId, lines: [] });
}

export function cartTotalCents(cart: Cart) {
  return cart.lines.reduce((s, l) => s + l.priceCents * l.qty, 0);
}

export function cartCount(cart: Cart) {
  return cart.lines.reduce((s, l) => s + l.qty, 0);
}
```

- [ ] **Step 5: Create `apps/web/components/customer/menu-categories.tsx`**

```tsx
import Link from "next/link";

type Cat = { id: string; name: string };

export function MenuCategories({
  slug, token, categories, activeId,
}: { slug: string; token: string; categories: Cat[]; activeId: string | null }) {
  if (categories.length === 0) {
    return <div className="border-b bg-slate-50 px-4 py-2 text-sm text-slate-500">No menu yet.</div>;
  }
  return (
    <div className="sticky top-[64px] z-10 overflow-x-auto border-b bg-white">
      <div className="flex gap-1 px-4 py-2">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/r/${slug}/t/${token}?category=${c.id}`}
            scroll={false}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${activeId === c.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `apps/web/components/customer/menu-item-list.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ItemSheet } from "./item-sheet";
import { addLine } from "@/lib/cart";

type Item = {
  id: string; name: string; description: string | null; priceCents: number;
  images: { id: string; path: string; sortOrder: number }[];
};

export function MenuItemList({
  items, slug, token, currency,
}: { items: Item[]; slug: string; token: string; currency: string }) {
  const [open, setOpen] = useState<Item | null>(null);
  // tableId lives in the signed cookie server-side but we also pass it into cart via a ref
  // via window.document.cookie isn't accessible (httpOnly). So we pass tableId from a data attribute.
  return (
    <>
      <div className="grid grid-cols-1 gap-3">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setOpen(item)}
            className="flex items-start gap-3 rounded-lg border bg-white p-3 text-left shadow-sm"
          >
            <div className="flex-1">
              <div className="font-medium">{item.name}</div>
              {item.description && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description}</p>
              )}
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {currency} {(item.priceCents / 100).toFixed(2)}
              </div>
            </div>
          </button>
        ))}
      </div>
      {open && (
        <ItemSheet
          item={open}
          currency={currency}
          onClose={() => setOpen(null)}
          onAdd={(qty, note) => {
            // tableId is the same across items — read from window-scoped data attr set by cart-bar
            const tableId = (document.querySelector("[data-table-id]") as HTMLElement | null)?.dataset["tableId"];
            if (!tableId) return;
            addLine(tableId, {
              menuItemId: open.id, name: open.name, priceCents: open.priceCents, qty, note,
            });
            setOpen(null);
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 7: Create `apps/web/components/customer/item-sheet.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

type Item = { id: string; name: string; description: string | null; priceCents: number };

export function ItemSheet({
  item, currency, onClose, onAdd,
}: {
  item: Item;
  currency: string;
  onClose: () => void;
  onAdd: (qty: number, note?: string) => void;
}) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-slate-900/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{item.name}</h2>
        {item.description && (
          <p className="mt-1 text-sm text-slate-600">{item.description}</p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="h-10 w-10 rounded-full border text-xl"
            aria-label="Decrease"
          >−</button>
          <span className="w-8 text-center text-lg">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(99, q + 1))}
            className="h-10 w-10 rounded-full border text-xl"
            aria-label="Increase"
          >+</button>
        </div>
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="e.g. no onions"
            className="input"
          />
        </label>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border px-4 py-3 text-sm"
          >Cancel</button>
          <button
            type="button"
            onClick={() => onAdd(qty, note.trim() || undefined)}
            className="flex-[2] rounded-md bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Add — {currency} {((item.priceCents * qty) / 100).toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create `apps/web/components/customer/cart-bar.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cartCount, cartTotalCents, readCart } from "@/lib/cart";

export function CartBar({
  slug, token, tableId, currency,
}: { slug: string; token: string; tableId: string; currency: string }) {
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const update = () => {
      const cart = readCart(tableId);
      setCount(cartCount(cart));
      setTotal(cartTotalCents(cart));
    };
    update();
    const onStorage = () => update();
    window.addEventListener("cart-change", onStorage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("cart-change", onStorage);
      window.removeEventListener("storage", onStorage);
    };
  }, [tableId]);

  if (count === 0) return <span data-table-id={tableId} className="hidden" />;

  return (
    <div data-table-id={tableId} className="fixed inset-x-0 bottom-0 z-10 border-t bg-white p-3 shadow-lg">
      <Link
        href={`/r/${slug}/t/${token}/cart`}
        className="flex items-center justify-between gap-4 rounded-lg bg-brand-500 px-4 py-3 text-white"
      >
        <span className="text-sm font-medium">View cart · {count} item{count === 1 ? "" : "s"}</span>
        <span className="font-semibold">{currency} {(total / 100).toFixed(2)}</span>
      </Link>
    </div>
  );
}
```

- [ ] **Step 9: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): customer menu page at /r/:slug/t/:token with cart bar + item sheet"
```

---

### Task 7: Cart review + checkout page + order submit

**Files:**
- Create: `apps/web/app/r/[slug]/t/[token]/cart/page.tsx`, `checkout/page.tsx`
- Create: `apps/web/components/customer/cart-list.tsx`, `checkout-form.tsx`
- Create: `apps/web/server/actions/order.ts`

- [ ] **Step 1: Create `apps/web/server/actions/order.ts`**

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TABLE_COOKIE, verifyTableCookie } from "@/lib/table-session";
import { createOrder } from "@/server/services/order";
import type { ActionResult } from "@/server/actions/auth";

export async function submitOrderAction(
  raw: unknown,
): Promise<ActionResult<{ code: string }>> {
  const cookieValue = cookies().get(TABLE_COOKIE)?.value;
  const session = verifyTableCookie(cookieValue);
  if (!session) {
    return { ok: false, error: { code: "NO_SESSION", message: "Table session expired. Rescan the QR code." } };
  }
  const result = await createOrder(session.rid, session.tid, raw);
  if (!result.ok) return result;
  return { ok: true, data: { code: result.data.code } };
}
```

- [ ] **Step 2: Create `apps/web/app/r/[slug]/t/[token]/cart/page.tsx`**

```tsx
import { CartList } from "@/components/customer/cart-list";

export const dynamic = "force-dynamic";

export default function CartPage({
  params,
}: { params: { slug: string; token: string } }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3">
        <a href={`/r/${params.slug}/t/${params.token}`} className="text-sm text-slate-600">← Back to menu</a>
        <h1 className="mt-1 text-lg font-semibold">Your order</h1>
      </header>
      <CartList slug={params.slug} token={params.token} />
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/components/customer/cart-list.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readCart, updateLine, removeLine, cartTotalCents, type Cart } from "@/lib/cart";

export function CartList({ slug, token }: { slug: string; token: string }) {
  const [tableId, setTableId] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);

  useEffect(() => {
    // The table id isn't in a client-readable cookie (httpOnly). Use localStorage key discovery:
    // We look for any cart_* key — if exactly one exists, it's this table's.
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith("cart_")) {
        const id = k.slice("cart_".length);
        setTableId(id);
        setCart(readCart(id));
        break;
      }
    }
  }, []);

  useEffect(() => {
    if (!tableId) return;
    const update = () => setCart(readCart(tableId));
    window.addEventListener("cart-change", update);
    return () => window.removeEventListener("cart-change", update);
  }, [tableId]);

  if (!tableId || !cart) {
    return (
      <div className="p-6 text-center text-sm text-slate-500">
        Your cart is empty.{" "}
        <Link href={`/r/${slug}/t/${token}`} className="text-brand-600 underline">Back to menu</Link>
      </div>
    );
  }
  if (cart.lines.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-slate-500">
        Your cart is empty.{" "}
        <Link href={`/r/${slug}/t/${token}`} className="text-brand-600 underline">Back to menu</Link>
      </div>
    );
  }

  const total = cartTotalCents(cart);

  return (
    <main className="space-y-4 p-4 pb-28">
      <ul className="space-y-2">
        {cart.lines.map((l, i) => (
          <li key={i} className="flex items-start gap-3 rounded-lg border bg-white p-3">
            <div className="flex-1">
              <div className="font-medium">{l.name}</div>
              {l.note && <div className="text-xs text-slate-500">{l.note}</div>}
              <div className="mt-1 text-sm text-slate-700">
                €{(l.priceCents / 100).toFixed(2)} × {l.qty}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateLine(tableId, i, { qty: l.qty - 1 })}
                className="h-8 w-8 rounded-full border"
                aria-label="Decrease"
              >−</button>
              <span className="w-6 text-center">{l.qty}</span>
              <button
                onClick={() => updateLine(tableId, i, { qty: l.qty + 1 })}
                className="h-8 w-8 rounded-full border"
                aria-label="Increase"
              >+</button>
              <button
                onClick={() => removeLine(tableId, i)}
                className="ml-2 text-xs text-red-600 hover:underline"
              >Remove</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="fixed inset-x-0 bottom-0 border-t bg-white p-3 shadow-lg">
        <div className="mb-2 flex justify-between text-sm">
          <span>Subtotal</span>
          <span className="font-semibold">€{(total / 100).toFixed(2)}</span>
        </div>
        <p className="mb-3 text-xs text-slate-500">Tax and service are added at checkout.</p>
        <Link
          href={`/r/${slug}/t/${token}/checkout`}
          className="block rounded-md bg-brand-500 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-brand-600"
        >
          Checkout
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Create `apps/web/app/r/[slug]/t/[token]/checkout/page.tsx`**

```tsx
import { CheckoutForm } from "@/components/customer/checkout-form";

export const dynamic = "force-dynamic";

export default function CheckoutPage({
  params,
}: { params: { slug: string; token: string } }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3">
        <a href={`/r/${params.slug}/t/${params.token}/cart`} className="text-sm text-slate-600">← Back to cart</a>
        <h1 className="mt-1 text-lg font-semibold">Checkout</h1>
      </header>
      <CheckoutForm slug={params.slug} token={params.token} />
    </div>
  );
}
```

- [ ] **Step 5: Create `apps/web/components/customer/checkout-form.tsx`**

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readCart, cartTotalCents, clearCart, type Cart } from "@/lib/cart";
import { submitOrderAction } from "@/server/actions/order";

function uuid() {
  // fallback uuid v4
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

export function CheckoutForm({ slug, token }: { slug: string; token: string }) {
  const router = useRouter();
  const [tableId, setTableId] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith("cart_")) {
        const id = k.slice("cart_".length);
        setTableId(id);
        setCart(readCart(id));
        break;
      }
    }
  }, []);

  if (!cart || cart.lines.length === 0 || !tableId) {
    return <div className="p-6 text-sm text-slate-500">Cart is empty.</div>;
  }

  const submit = (paymentMethod: "cash" | "card") => {
    setError(null);
    startTransition(async () => {
      const r = await submitOrderAction({
        paymentMethod,
        items: cart.lines.map((l) => ({ menuItemId: l.menuItemId, qty: l.qty, note: l.note })),
        idempotencyKey: uuid(),
      });
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      clearCart(tableId);
      router.replace(`/r/${slug}/t/${token}/order/${r.data.code}`);
    });
  };

  const total = cartTotalCents(cart);

  return (
    <main className="space-y-4 p-4 pb-32">
      <section className="rounded-lg border bg-white p-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Subtotal</span>
          <span className="font-semibold">€{(total / 100).toFixed(2)}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Final total including tax/service is calculated when you place the order.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Pay with</h2>
        <button
          type="button"
          onClick={() => submit("cash")}
          disabled={pending}
          className="w-full rounded-lg border bg-white p-4 text-left shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <div className="font-semibold">Cash</div>
          <div className="text-xs text-slate-500">Pay your server when they bring the bill.</div>
        </button>
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-lg border bg-white p-4 text-left opacity-50"
          title="Card payment coming in Phase 3"
        >
          <div className="font-semibold">Card</div>
          <div className="text-xs text-slate-500">Coming soon.</div>
        </button>
      </section>

      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {pending && <p className="text-sm text-slate-600">Placing order…</p>}
    </main>
  );
}
```

- [ ] **Step 6: Commit**

```bash
pnpm typecheck
pnpm -F @app/web build
git add -A && git commit -m "feat(web): customer cart + checkout pages with submitOrder server action"
```

---

### Task 8: Order status page

**Files:**
- Create: `apps/web/app/r/[slug]/t/[token]/order/[code]/page.tsx`
- Create: `apps/web/components/customer/order-status.tsx`

- [ ] **Step 1: Create `apps/web/app/r/[slug]/t/[token]/order/[code]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { resolveTableFromToken } from "@/server/services/table-session";
import { getOrderByCode } from "@/server/services/order";
import { OrderStatus } from "@/components/customer/order-status";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: { params: { slug: string; token: string; code: string } }) {
  const resolved = await resolveTableFromToken(params.slug, params.token);
  if (!resolved.ok) notFound();
  const order = await getOrderByCode(resolved.data.restaurantId, params.code);
  if (!order) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-4 py-3">
        <h1 className="text-lg font-semibold">Order {order.code}</h1>
        <div className="text-xs text-slate-500">
          Table {order.table.label ?? order.table.number} · {resolved.data.restaurant.name}
        </div>
      </header>
      <main className="space-y-4 p-4">
        <OrderStatus status={order.status} paymentMethod={order.paymentMethod} paymentStatus={order.paymentStatus} />
        <section className="rounded-lg border bg-white p-4">
          <ul className="space-y-2 text-sm">
            {order.items.map((it) => (
              <li key={it.id} className="flex justify-between">
                <span>{it.qty}× {it.nameSnapshot}{it.note ? ` — ${it.note}` : ""}</span>
                <span>€{(it.lineTotalCents / 100).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <hr className="my-3" />
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal</span><span>€{(order.subtotalCents / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Tax</span><span>€{(order.taxCents / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Service</span><span>€{(order.serviceCents / 100).toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between text-base font-semibold">
            <span>Total</span><span>€{(order.totalCents / 100).toFixed(2)}</span>
          </div>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/components/customer/order-status.tsx`**

```tsx
const STEPS = [
  { key: "received", label: "Received" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "served", label: "Served" },
] as const;

export function OrderStatus({
  status, paymentMethod, paymentStatus,
}: {
  status: "received" | "preparing" | "ready" | "served" | "cancelled";
  paymentMethod: "card" | "cash";
  paymentStatus: "unpaid" | "paid" | "refunded";
}) {
  const currentIdx = status === "cancelled" ? -1 : STEPS.findIndex((s) => s.key === status);
  return (
    <section className="rounded-lg border bg-white p-4">
      {status === "cancelled" ? (
        <div className="text-center text-sm font-medium text-red-600">This order was cancelled.</div>
      ) : (
        <ol className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-1 flex-col items-center">
              <div
                className={`h-3 w-3 rounded-full ${i <= currentIdx ? "bg-brand-500" : "bg-slate-200"}`}
                aria-current={i === currentIdx ? "step" : undefined}
              />
              <span className={`mt-1 text-[11px] ${i <= currentIdx ? "text-slate-900" : "text-slate-400"}`}>
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3 text-center text-xs text-slate-500">
        Payment: {paymentMethod} · {paymentStatus}
        {paymentMethod === "cash" && paymentStatus === "unpaid" && " — pay your server"}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): customer order status page with progress timeline"
```

---

### Task 9: Admin orders list page

**Files:**
- Create: `apps/web/app/(admin)/orders/page.tsx`
- Create: `apps/web/components/admin/orders-list.tsx`
- Create: `apps/web/server/actions/order-admin.ts` (markPaid, setStatus — simple for now)
- Modify: `apps/web/components/admin/sidebar.tsx` — flip `orders` from `ready: false` to `ready: true`

- [ ] **Step 1: Create `apps/web/server/actions/order-admin.ts`**

```ts
"use server";

import { requireMembership } from "@/lib/membership";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/server/actions/auth";

type Status = "received" | "preparing" | "ready" | "served" | "cancelled";

export async function setOrderStatusAction(
  id: string, status: Status,
): Promise<ActionResult<{ id: string }>> {
  const { restaurantId } = await requireMembership();
  const { count } = await prisma.order.updateMany({
    where: { id, restaurantId },
    data: { status },
  });
  if (count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Order not found." } };
  return { ok: true, data: { id } };
}

export async function markOrderPaidAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const { restaurantId } = await requireMembership();
  const { count } = await prisma.order.updateMany({
    where: { id, restaurantId },
    data: { paymentStatus: "paid", paidAt: new Date() },
  });
  if (count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Order not found." } };
  return { ok: true, data: { id } };
}
```

- [ ] **Step 2: Create `apps/web/app/(admin)/orders/page.tsx`**

```tsx
import { requireMembership } from "@/lib/membership";
import { listOrdersForRestaurant } from "@/server/services/order";
import { OrdersList } from "@/components/admin/orders-list";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { restaurantId } = await requireMembership();
  const orders = await listOrdersForRestaurant(restaurantId);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Orders</h1>
      <OrdersList orders={orders.map((o) => ({
        id: o.id, code: o.code, status: o.status, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus,
        total: o.totalCents, createdAt: o.createdAt.toISOString(),
        tableLabel: o.table.label ?? `Table ${o.table.number}`,
        items: o.items.map((it) => ({ id: it.id, qty: it.qty, name: it.nameSnapshot, station: it.station, note: it.note, status: it.status })),
      }))} />
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/components/admin/orders-list.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOrderStatusAction, markOrderPaidAction } from "@/server/actions/order-admin";

type Order = {
  id: string; code: string;
  status: "received" | "preparing" | "ready" | "served" | "cancelled";
  paymentMethod: "card" | "cash";
  paymentStatus: "unpaid" | "paid" | "refunded";
  total: number; createdAt: string; tableLabel: string;
  items: { id: string; qty: number; name: string; station: "kitchen" | "bar" | "both"; note: string | null; status: string }[];
};

const NEXT: Record<Order["status"], Order["status"] | null> = {
  received: "preparing",
  preparing: "ready",
  ready: "served",
  served: null,
  cancelled: null,
};

export function OrdersList({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const advance = (id: string, status: Order["status"]) => {
    const next = NEXT[status];
    if (!next) return;
    startTransition(async () => {
      await setOrderStatusAction(id, next);
      router.refresh();
    });
  };

  const markPaid = (id: string) => {
    startTransition(async () => {
      await markOrderPaidAction(id);
      router.refresh();
    });
  };

  if (orders.length === 0) {
    return <div className="rounded-lg border border-dashed p-8 text-center text-slate-500">No orders yet.</div>;
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div key={o.id} className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-sm font-semibold">{o.code}</div>
              <div className="text-xs text-slate-500">
                {o.tableLabel} · {new Date(o.createdAt).toLocaleTimeString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">€{(o.total / 100).toFixed(2)}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                {o.paymentMethod} · {o.paymentStatus}
              </div>
            </div>
          </div>
          <ul className="mt-2 space-y-0.5 text-sm">
            {o.items.map((it) => (
              <li key={it.id} className="flex justify-between">
                <span>{it.qty}× {it.name}{it.note ? ` — ${it.note}` : ""}</span>
                <span className="text-[10px] uppercase text-slate-500">{it.station}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{o.status}</span>
            {NEXT[o.status] && (
              <button
                disabled={pending}
                onClick={() => advance(o.id, o.status)}
                className="rounded-md bg-brand-500 px-3 py-1.5 text-xs text-white hover:bg-brand-600 disabled:opacity-50"
              >
                Mark {NEXT[o.status]}
              </button>
            )}
            {o.paymentStatus === "unpaid" && (
              <button
                disabled={pending}
                onClick={() => markPaid(o.id)}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
              >
                Mark paid
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Flip sidebar Orders to ready=true**

Change `{ href: "/orders", label: "Orders", ready: false }` → `ready: true` in `apps/web/components/admin/sidebar.tsx`.

- [ ] **Step 5: Typecheck, build, commit**

```bash
pnpm typecheck
pnpm -F @app/web build
git add -A && git commit -m "feat(web): admin /orders page with status progression + mark paid"
```

---

### Task 10: Smoke test + push to prod

- [ ] **Step 1: Run full test suite**

```bash
pnpm -F @app/web test
```

Expected: all tests pass (existing 38 + new ones from Phase 2).

- [ ] **Step 2: Run lint + build**

```bash
pnpm lint
pnpm -F @app/web build
```

- [ ] **Step 3: Push to prod**

```bash
git push
```

Vercel auto-deploys. Wait ~90s.

- [ ] **Step 4: Smoke test via browser**

1. Sign in to your admin account.
2. Visit /tables → copy a table URL (or scan a QR code from the printed PDF).
3. Open that URL in an incognito window (customer view).
4. Browse menu → add an item with a note → go to cart → checkout → pay cash → land on order status.
5. Return to admin at /orders → see the new order → click "Mark preparing" → "Mark ready" → "Mark served" → "Mark paid".

If any step fails, diagnose via Vercel runtime logs and patch.

---

## Phase 2 Acceptance

- [ ] Anonymous customer can scan a QR → browse menu → submit a cash order.
- [ ] Tax + service are correctly calculated and stored.
- [ ] Idempotency prevents duplicate orders on network retry.
- [ ] Order code is unique per restaurant; displayed to both customer and admin.
- [ ] Admin sees incoming orders at /orders and can advance status + mark paid.
- [ ] All existing Phase 1A/1B tests still pass.
- [ ] CI is green.
- [ ] Live prod URL works end-to-end.

## Notes for Phase 3

- Swap Cash-only checkout for a Card option wired to Stripe Payment Element.
- Add Stripe webhook handler to flip `paymentStatus=paid` + `stripePaymentIntentId`.
- Refund flow from admin.
- Receipt email via Resend after successful card payment.
