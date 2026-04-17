# Super Admin Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a super admin dashboard at `/super-admin` visible only to `mkifokeris@itdev.gr`. Shows all restaurants with their full menu, orders, revenue, staff, and order status breakdowns.

**Architecture:** Add `isSuperAdmin` boolean to the User model. Create a `(super-admin)` route group with its own layout (no restaurant sidebar). New services query across all restaurants without tenant scoping. "Admin" button appears in the admin topbar only for super admin users.

**Tech Stack:** Prisma schema update, new server services + pages. No new deps.

---

## File Structure

```
packages/db/prisma/
└── schema.prisma                          # MODIFY — add isSuperAdmin to User

apps/web/
├── lib/
│   └── require-role.ts                    # MODIFY — add requireSuperAdmin()
├── server/services/
│   └── super-admin.ts                     # CREATE — cross-restaurant queries
├── components/admin/
│   └── topbar.tsx                         # MODIFY — show "Super Admin" button
├── app/
│   └── (super-admin)/
│       ├── layout.tsx                     # CREATE — full-width layout, no sidebar
│       └── super-admin/
│           ├── page.tsx                   # CREATE — overview with all restaurants
│           └── restaurant/
│               └── [id]/
│                   └── page.tsx           # CREATE — deep-dive into one restaurant
├── components/super-admin/
│   ├── restaurants-table.tsx              # CREATE — list of all restaurants
│   └── restaurant-detail.tsx             # CREATE — full restaurant breakdown
└── middleware.ts                          # MODIFY — protect /super-admin routes
```

---

## Tasks

### Task 1: Add `isSuperAdmin` to User model + set for mkifokeris@itdev.gr

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Migration generated

- [ ] **Step 1: Add `isSuperAdmin` field to User model**

In `packages/db/prisma/schema.prisma`, add to the User model after `lastLoginAt`:

```prisma
isSuperAdmin Boolean  @default(false)
```

- [ ] **Step 2: Generate + apply migration**

```bash
cd /Users/marios/Desktop/Cursor/restaurant
pnpm -F @app/db exec prisma migrate dev --name add_super_admin_flag
```

- [ ] **Step 3: Set mkifokeris@itdev.gr as super admin**

```bash
cd /Users/marios/Desktop/Cursor/restaurant/packages/db
node --env-file=.env -e "
import('@prisma/client').then(async ({ PrismaClient }) => {
  const p = new PrismaClient();
  const r = await p.user.updateMany({
    where: { email: 'mkifokeris@itdev.gr' },
    data: { isSuperAdmin: true },
  });
  console.log('Updated', r.count, 'user(s)');
  await p.\$disconnect();
})
"
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(db): add isSuperAdmin flag to User model"
```

---

### Task 2: Add `requireSuperAdmin` helper + protect routes

**Files:**
- Modify: `apps/web/lib/require-role.ts`
- Modify: `apps/web/middleware.ts`

- [ ] **Step 1: Add `requireSuperAdmin()` to `require-role.ts`**

Read file first. Append this function:

```ts
export async function requireSuperAdmin() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isSuperAdmin: true },
  });
  if (!dbUser?.isSuperAdmin) redirect("/dashboard");
  return { user };
}
```

Add the missing imports if needed: `import { prisma } from "@/lib/db";` and `import { getSessionUser } from "@/lib/auth-helpers";`

Also add a non-redirecting check helper:

```ts
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });
  return u?.isSuperAdmin === true;
}
```

- [ ] **Step 2: Add `/super-admin` to protected routes in middleware**

Read `apps/web/middleware.ts`. Add to the PROTECTED array:

```ts
/^\/super-admin/,
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(web): add requireSuperAdmin helper + protect /super-admin routes"
```

---

### Task 3: Create super admin service (cross-restaurant queries)

**Files:**
- Create: `apps/web/server/services/super-admin.ts`

All queries WITHOUT restaurantId scoping — full system view.

- [ ] **Step 1: Create `apps/web/server/services/super-admin.ts`**

```ts
import { prisma } from "@/lib/db";

export async function listAllRestaurants() {
  return prisma.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      address: true,
      currency: true,
      taxRate: true,
      serviceChargePct: true,
      createdAt: true,
      _count: {
        select: {
          categories: true,
          menuItems: true,
          tables: { where: { isArchived: false } },
          orders: true,
          memberships: true,
        },
      },
    },
  });
}

export async function getSystemStats() {
  const [
    totalRestaurants,
    totalUsers,
    totalOrders,
    totalRevenue,
    ordersByStatus,
    ordersByPayment,
  ] = await Promise.all([
    prisma.restaurant.count(),
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { totalCents: true } }),
    prisma.order.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["paymentMethod", "paymentStatus"],
      _count: true,
      _sum: { totalCents: true },
    }),
  ]);

  return {
    totalRestaurants,
    totalUsers,
    totalOrders,
    totalRevenueCents: totalRevenue._sum.totalCents ?? 0,
    ordersByStatus: ordersByStatus.map((s) => ({
      status: s.status,
      count: s._count,
    })),
    ordersByPayment: ordersByPayment.map((p) => ({
      method: p.paymentMethod,
      paymentStatus: p.paymentStatus,
      count: p._count,
      totalCents: p._sum.totalCents ?? 0,
    })),
  };
}

export async function getRestaurantDetail(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    select: {
      id: true,
      slug: true,
      name: true,
      address: true,
      currency: true,
      taxRate: true,
      serviceChargePct: true,
      createdAt: true,
    },
  });

  const [categories, menuItems, tables, orders, staff, stats] = await Promise.all([
    prisma.category.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        isArchived: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.menuItem.findMany({
      where: { restaurantId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        priceCents: true,
        station: true,
        isAvailable: true,
        isArchived: true,
        category: { select: { name: true } },
      },
    }),
    prisma.table.findMany({
      where: { restaurantId },
      orderBy: { number: "asc" },
      select: { id: true, number: true, label: true, token: true, isArchived: true },
    }),
    prisma.order.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        code: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        subtotalCents: true,
        taxCents: true,
        serviceCents: true,
        totalCents: true,
        customerName: true,
        customerEmail: true,
        createdAt: true,
        table: { select: { number: true, label: true } },
        items: {
          select: {
            id: true,
            nameSnapshot: true,
            qty: true,
            station: true,
            unitPriceCents: true,
            lineTotalCents: true,
            note: true,
            status: true,
          },
        },
      },
    }),
    prisma.membership.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
    }),
    // Aggregated stats
    Promise.all([
      prisma.order.aggregate({
        where: { restaurantId },
        _count: true,
        _sum: { totalCents: true },
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: { restaurantId },
        _count: true,
      }),
      prisma.order.groupBy({
        by: ["paymentMethod"],
        where: { restaurantId },
        _count: true,
        _sum: { totalCents: true },
      }),
    ]),
  ]);

  const [orderAgg, statusBreakdown, paymentBreakdown] = stats;

  return {
    restaurant,
    categories,
    menuItems,
    tables,
    orders,
    staff,
    stats: {
      totalOrders: orderAgg._count,
      totalRevenueCents: orderAgg._sum.totalCents ?? 0,
      byStatus: statusBreakdown.map((s) => ({ status: s.status, count: s._count })),
      byPayment: paymentBreakdown.map((p) => ({
        method: p.paymentMethod,
        count: p._count,
        totalCents: p._sum.totalCents ?? 0,
      })),
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): super admin service — cross-restaurant queries"
```

---

### Task 4: Create super admin layout + overview page

**Files:**
- Create: `apps/web/app/(super-admin)/layout.tsx`
- Create: `apps/web/app/(super-admin)/super-admin/page.tsx`
- Create: `apps/web/components/super-admin/restaurants-table.tsx`

- [ ] **Step 1: Create layout**

`apps/web/app/(super-admin)/layout.tsx`:

```tsx
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/require-role";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/super-admin" className="text-lg font-bold text-slate-900">
              <span className="text-red-500">⚡</span> Super Admin
            </Link>
          </div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
            ← Back to restaurant
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create overview page**

`apps/web/app/(super-admin)/super-admin/page.tsx`:

```tsx
import Link from "next/link";
import { listAllRestaurants, getSystemStats } from "@/server/services/super-admin";

export const metadata = { title: "Super Admin" };
export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const [restaurants, stats] = await Promise.all([
    listAllRestaurants(),
    getSystemStats(),
  ]);

  const fulfilled = stats.ordersByStatus.find((s) => s.status === "served")?.count ?? 0;
  const cancelled = stats.ordersByStatus.find((s) => s.status === "cancelled")?.count ?? 0;
  const cashOrders = stats.ordersByPayment.filter((p) => p.method === "cash");
  const cardOrders = stats.ordersByPayment.filter((p) => p.method === "card");
  const cashCount = cashOrders.reduce((s, p) => s + p.count, 0);
  const cardCount = cardOrders.reduce((s, p) => s + p.count, 0);
  const cashRevenue = cashOrders.reduce((s, p) => s + p.totalCents, 0);
  const cardRevenue = cardOrders.reduce((s, p) => s + p.totalCents, 0);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">System Overview</h1>

      {/* Global stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Restaurants" value={String(stats.totalRestaurants)} />
        <StatCard label="Users" value={String(stats.totalUsers)} />
        <StatCard label="Total Orders" value={String(stats.totalOrders)} />
        <StatCard label="Total Revenue" value={`€${(stats.totalRevenueCents / 100).toFixed(2)}`} />
      </div>

      {/* Order breakdown */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Fulfilled" value={String(fulfilled)} color="green" />
        <StatCard label="Cancelled" value={String(cancelled)} color="red" />
        <StatCard label="Cash Orders" value={`${cashCount} (€${(cashRevenue / 100).toFixed(2)})`} />
        <StatCard label="Card Orders" value={`${cardCount} (€${(cardRevenue / 100).toFixed(2)})`} />
      </div>

      {/* Restaurants list */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">All Restaurants</h2>
        <div className="space-y-3">
          {restaurants.map((r) => (
            <Link
              key={r.id}
              href={`/super-admin/restaurant/${r.id}`}
              className="flex items-center justify-between rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div>
                <div className="font-semibold text-slate-900">{r.name}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {r.slug} · {r.address ?? "No address"} · {r.currency}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Created {new Date(r.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-4 text-center text-xs">
                <div>
                  <div className="text-lg font-bold text-slate-900">{r._count.orders}</div>
                  <div className="text-slate-500">orders</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{r._count.menuItems}</div>
                  <div className="text-slate-500">items</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{r._count.tables}</div>
                  <div className="text-slate-500">tables</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{r._count.memberships}</div>
                  <div className="text-slate-500">staff</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "green" | "red";
}) {
  const colorClass =
    color === "green"
      ? "text-green-600"
      : color === "red"
        ? "text-red-600"
        : "text-slate-900";
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): super admin overview page with system stats + restaurant list"
```

---

### Task 5: Create restaurant detail page (deep-dive)

**Files:**
- Create: `apps/web/app/(super-admin)/super-admin/restaurant/[id]/page.tsx`

Shows EVERYTHING about a single restaurant: info, menu, orders, staff, stats.

- [ ] **Step 1: Create the detail page**

`apps/web/app/(super-admin)/super-admin/restaurant/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRestaurantDetail } from "@/server/services/super-admin";

export const dynamic = "force-dynamic";

export default async function RestaurantDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let data;
  try {
    data = await getRestaurantDetail(params.id);
  } catch {
    notFound();
  }

  const { restaurant, categories, menuItems, tables, orders, staff, stats } = data;
  const fulfilled = stats.byStatus.find((s) => s.status === "served")?.count ?? 0;
  const cancelled = stats.byStatus.find((s) => s.status === "cancelled")?.count ?? 0;
  const pending = stats.byStatus
    .filter((s) => ["received", "preparing", "ready"].includes(s.status))
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/super-admin" className="text-sm text-slate-500 hover:text-slate-700">
          ← All restaurants
        </Link>
      </div>

      {/* Restaurant info */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">{restaurant.name}</h1>
        <div className="mt-2 space-y-1 text-sm text-slate-500">
          <div>Slug: <code className="rounded bg-slate-100 px-1.5 py-0.5">{restaurant.slug}</code></div>
          <div>Address: {restaurant.address ?? "—"}</div>
          <div>Currency: {restaurant.currency} · Tax: {restaurant.taxRate.toString()}% · Service: {restaurant.serviceChargePct.toString()}%</div>
          <div>Created: {new Date(restaurant.createdAt).toLocaleString()}</div>
          <div>ID: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{restaurant.id}</code></div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SC label="Total Orders" value={String(stats.totalOrders)} />
        <SC label="Revenue" value={`€${(stats.totalRevenueCents / 100).toFixed(2)}`} />
        <SC label="Fulfilled" value={String(fulfilled)} color="green" />
        <SC label="Pending" value={String(pending)} color="amber" />
        <SC label="Cancelled" value={String(cancelled)} color="red" />
      </div>

      {/* Payment breakdown */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Payment Breakdown</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {stats.byPayment.map((p) => (
            <div key={p.method} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{p.method}</div>
              <div className="mt-1 text-lg font-bold">{p.count} orders</div>
              <div className="text-sm text-slate-600">€{(p.totalCents / 100).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Staff */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Staff ({staff.length})</h2>
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {staff.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 font-medium">{m.user.name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{m.user.email}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{m.role}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{new Date(m.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Menu */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Menu ({menuItems.length} items in {categories.length} categories)</h2>
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Station</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {menuItems.map((item) => (
                <tr key={item.id} className={item.isArchived ? "opacity-50" : ""}>
                  <td className="px-4 py-2 font-medium">{item.name}</td>
                  <td className="px-4 py-2 text-slate-600">{item.category.name}</td>
                  <td className="px-4 py-2">€{(item.priceCents / 100).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{item.station}</span>
                  </td>
                  <td className="px-4 py-2">
                    {item.isArchived ? (
                      <span className="text-xs text-red-500">archived</span>
                    ) : item.isAvailable ? (
                      <span className="text-xs text-green-600">available</span>
                    ) : (
                      <span className="text-xs text-orange-500">86&apos;d</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tables */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Tables ({tables.length})</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {tables.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg border p-2 text-center text-xs ${t.isArchived ? "bg-slate-100 opacity-50" : "bg-white"}`}
            >
              <div className="font-bold">{t.number}</div>
              <div className="truncate text-slate-400">{t.label ?? ""}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent orders */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent Orders (last 50)</h2>
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Table</th>
                <th className="px-4 py-2">Items</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Payment</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2 font-mono font-medium">{o.code}</td>
                  <td className="px-4 py-2">{o.table.label ?? `Table ${o.table.number}`}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {o.items.map((it) => `${it.qty}× ${it.nameSnapshot}`).join(", ")}
                  </td>
                  <td className="px-4 py-2 font-medium">€{(o.totalCents / 100).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{o.paymentMethod}</span>
                    {" "}
                    <span className={`text-xs ${o.paymentStatus === "paid" ? "text-green-600" : o.paymentStatus === "refunded" ? "text-red-500" : "text-orange-500"}`}>
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{o.status}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SC({ label, value, color }: { label: string; value: string; color?: "green" | "red" | "amber" }) {
  const c = color === "green" ? "text-green-600" : color === "red" ? "text-red-600" : color === "amber" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${c}`}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): super admin restaurant detail page — full menu/orders/staff/stats"
```

---

### Task 6: Add "Super Admin" button to topbar

**Files:**
- Modify: `apps/web/components/admin/topbar.tsx`

Show a red "⚡ Admin" button next to "Sign out" — only visible when the user is a super admin.

- [ ] **Step 1: Update topbar to check isSuperAdmin**

Read `apps/web/components/admin/topbar.tsx` first. It's a client component. We need to pass `isSuperAdmin` as a prop from the server (the admin layout).

First, update the layout to pass the flag. Read `apps/web/app/(admin)/layout.tsx`. After the `getSessionUser()` call, add:

```ts
const dbUser = await prisma.user.findUnique({
  where: { id: user.id },
  select: { isSuperAdmin: true },
});
```

Then pass `isSuperAdmin={dbUser?.isSuperAdmin ?? false}` to the `<Topbar>` component.

In `topbar.tsx`, add the prop and render a link:

```tsx
export function Topbar({
  restaurantName,
  userEmail,
  isSuperAdmin,
}: {
  restaurantName: string;
  userEmail: string;
  isSuperAdmin?: boolean;
}) {
```

Add before the "Sign out" button:

```tsx
{isSuperAdmin && (
  <Link
    href="/super-admin"
    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
  >
    ⚡ Admin
  </Link>
)}
```

Add `import Link from "next/link";` at the top.

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): show Super Admin button in topbar for super admin users"
```

---

### Task 7: Build + deploy + smoke test

- [ ] **Step 1: Build**

```bash
pnpm typecheck
pnpm -F @app/web build
```

Expected: `/super-admin` and `/super-admin/restaurant/[id]` in route table.

- [ ] **Step 2: Push + deploy**

```bash
git push
cd /Users/marios/Desktop/Cursor/restaurant
npx -y vercel link --yes --project restaurant-web
npx -y vercel --prod --yes
```

- [ ] **Step 3: Smoke test**

1. Log in as `mkifokeris@itdev.gr`
2. See "⚡ Admin" button in topbar
3. Click it → `/super-admin` overview with system stats + all restaurants
4. Click a restaurant → full detail page with menu, orders, staff, tables, payment breakdown
5. Log in as another account → "⚡ Admin" button NOT visible

---

## Acceptance Criteria

- [ ] `isSuperAdmin` field on User model, set true for mkifokeris@itdev.gr
- [ ] `/super-admin` protected — non-super-admins redirected to /dashboard
- [ ] Overview shows: total restaurants, users, orders, revenue, fulfilled/cancelled/cash/card breakdown
- [ ] Restaurant list shows each restaurant with order/item/table/staff counts
- [ ] Click restaurant → full detail: info, payment breakdown, staff table, menu table, tables grid, recent 50 orders table
- [ ] "⚡ Admin" button in topbar only for super admin
- [ ] Other users see no "Admin" button and cannot access /super-admin
- [ ] No regressions on existing admin/customer pages
