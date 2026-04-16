# Restaurant Platform — Phase 5: Settings, Reports, Staff Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Owner can edit restaurant settings, view basic reports (revenue, top items), and invite/manage staff with role-based access to station boards.

**Architecture:** Settings reuses the existing `CreateRestaurantInput` zod schema with an update variant. Reports are server-rendered DB aggregates (no chart library). Staff invite creates a Supabase auth user + Membership row via admin API (same pattern as owner signup). Middleware enforces role-based access: kitchen staff → `/kitchen` only, etc.

**Out of scope:** SaaS billing (Phase 6), mobile design polish, dark mode, i18n.

---

## Tasks

### Task 1: Settings page — edit restaurant info

**Files:**
- Create: `packages/shared/src/zod/restaurant-update.ts` (or extend existing)
- Create: `apps/web/server/services/restaurant-settings.ts`
- Create: `apps/web/server/actions/restaurant-settings.ts`
- Create: `apps/web/app/(admin)/settings/page.tsx`
- Create: `apps/web/components/admin/settings-form.tsx`

The settings form mirrors the onboarding form but pre-fills with current values and calls an update action instead of create.

- [ ] **Step 1: Add `UpdateRestaurantInput` to `packages/shared/src/zod/restaurant.ts`**

Append to existing file:

```ts
export const UpdateRestaurantInput = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).optional(),
  currency: CurrencySchema,
  taxRatePct: z.coerce.number().min(0).max(100),
  serviceChargePct: z.coerce.number().min(0).max(100),
});
export type UpdateRestaurantInput = z.infer<typeof UpdateRestaurantInput>;
```

- [ ] **Step 2: Create `apps/web/server/services/restaurant-settings.ts`**

```ts
import { prisma } from "@/lib/db";
import { UpdateRestaurantInput } from "@app/shared/zod/restaurant";
import type { ActionResult } from "@/server/actions/auth";

export async function getRestaurantSettings(restaurantId: string) {
  return prisma.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    select: { id: true, slug: true, name: true, address: true, currency: true, taxRate: true, serviceChargePct: true },
  });
}

export async function updateRestaurantSettings(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = UpdateRestaurantInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input.", fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) } };
  }
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      currency: parsed.data.currency,
      taxRate: parsed.data.taxRatePct,
      serviceChargePct: parsed.data.serviceChargePct,
    },
  });
  return { ok: true, data: { id: restaurantId } };
}
```

- [ ] **Step 3: Create server action wrapper**

```ts
"use server";
import { requireMembership } from "@/lib/membership";
import { updateRestaurantSettings } from "@/server/services/restaurant-settings";

export async function updateRestaurantAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return updateRestaurantSettings(restaurantId, raw);
}
```

- [ ] **Step 4: Create settings page + form**

`apps/web/app/(admin)/settings/page.tsx` — server component that loads current settings and passes to `<SettingsForm>`.

`apps/web/components/admin/settings-form.tsx` — client form using RHF + zod, calls `updateRestaurantAction`, shows success message on save. Uses shared `Field` component.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): settings page — edit restaurant name, address, currency, tax, service"
```

---

### Task 2: Dashboard summary stats

**Files:**
- Modify: `apps/web/app/(admin)/dashboard/page.tsx`
- Create: `apps/web/server/services/dashboard-stats.ts`

Replace the placeholder dashboard with real stats:
- Today's order count + revenue
- Pending orders count
- Total tables count

- [ ] **Step 1: Create `apps/web/server/services/dashboard-stats.ts`**

```ts
import { prisma } from "@/lib/db";

export async function getDashboardStats(restaurantId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todayOrders, pendingOrders, totalTables] = await Promise.all([
    prisma.order.aggregate({
      where: { restaurantId, createdAt: { gte: startOfDay } },
      _count: true,
      _sum: { totalCents: true },
    }),
    prisma.order.count({
      where: { restaurantId, status: { in: ["received", "preparing", "ready"] } },
    }),
    prisma.table.count({
      where: { restaurantId, isArchived: false },
    }),
  ]);

  return {
    todayOrderCount: todayOrders._count,
    todayRevenueCents: todayOrders._sum.totalCents ?? 0,
    pendingOrders,
    totalTables,
  };
}
```

- [ ] **Step 2: Update dashboard page to render stat cards**

Replace the placeholder div with 4 stat cards (order count, revenue, pending, tables). Use simple Tailwind cards with large numbers.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): dashboard summary stats (today's orders, revenue, pending, tables)"
```

---

### Task 3: Reports page — revenue by day, top items, payment split

**Files:**
- Create: `apps/web/server/services/reports.ts`
- Create: `apps/web/app/(admin)/reports/page.tsx`
- Create: `apps/web/components/admin/reports/stat-card.tsx`
- Create: `apps/web/components/admin/reports/bar-chart.tsx` (CSS-only bars)
- Create: `apps/web/components/admin/reports/top-items.tsx`

- [ ] **Step 1: Create `apps/web/server/services/reports.ts`**

```ts
import { prisma } from "@/lib/db";

export async function getRevenueByDay(restaurantId: string, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: { restaurantId, createdAt: { gte: since } },
    select: { createdAt: true, totalCents: true },
  });

  const byDay: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    byDay[d.toISOString().slice(0, 10)] = 0;
  }
  for (const o of orders) {
    const key = o.createdAt.toISOString().slice(0, 10);
    if (key in byDay) byDay[key] = (byDay[key] ?? 0) + o.totalCents;
  }
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cents]) => ({ date, cents }));
}

export async function getTopItems(restaurantId: string, limit = 5) {
  const items = await prisma.orderItem.groupBy({
    by: ["nameSnapshot"],
    where: { order: { restaurantId } },
    _sum: { qty: true },
    orderBy: { _sum: { qty: "desc" } },
    take: limit,
  });
  return items.map((i) => ({ name: i.nameSnapshot, qty: i._sum.qty ?? 0 }));
}

export async function getPaymentSplit(restaurantId: string) {
  const orders = await prisma.order.groupBy({
    by: ["paymentMethod"],
    where: { restaurantId },
    _count: true,
    _sum: { totalCents: true },
  });
  return orders.map((g) => ({
    method: g.paymentMethod,
    count: g._count,
    totalCents: g._sum.totalCents ?? 0,
  }));
}
```

- [ ] **Step 2: Create UI components**

`stat-card.tsx` — reusable card with label + big number.
`bar-chart.tsx` — CSS bar chart (divs with `width: %` based on max value).
`top-items.tsx` — ordered list with qty bars.

- [ ] **Step 3: Create `apps/web/app/(admin)/reports/page.tsx`**

Server component that loads all 3 report queries and renders:
- Revenue by day (bar chart)
- Top 5 items (list with bars)
- Payment split (cash vs card count + revenue)

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): reports page — revenue by day, top items, payment split"
```

---

### Task 4: Staff invite service + action with TDD

**Files:**
- Create: `packages/shared/src/zod/staff.ts`
- Create: `apps/web/server/services/staff.ts`
- Create: `apps/web/server/actions/staff.ts`
- Create: `apps/web/__tests__/server/services/staff.test.ts`

Staff invite:
1. Validate email + role
2. Create Supabase auth user via admin API (with auto-confirm)
3. Create public.User mirror row
4. Create Membership with the chosen role
5. Return staff member info

- [ ] **Step 1: Create `packages/shared/src/zod/staff.ts`**

```ts
import { z } from "zod";

export const STAFF_ROLES = ["manager", "kitchen", "bar", "cashier"] as const;
export const StaffRoleSchema = z.enum(STAFF_ROLES);
export type StaffRole = z.infer<typeof StaffRoleSchema>;

export const InviteStaffInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(80).optional(),
  role: StaffRoleSchema,
});
export type InviteStaffInput = z.infer<typeof InviteStaffInput>;
```

Update `packages/shared/src/index.ts` and `package.json` exports.

- [ ] **Step 2: Write failing test**

Tests: invite creates auth user + User + Membership with role; duplicate email returns EMAIL_TAKEN; invite scoped to restaurant.

- [ ] **Step 3: Implement `apps/web/server/services/staff.ts`**

```ts
import { prisma } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { InviteStaffInput } from "@app/shared/zod/staff";
import type { ActionResult } from "@/server/actions/auth";

export async function inviteStaff(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ userId: string; membershipId: string }>> {
  const parsed = InviteStaffInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const { email, name, role } = parsed.data;

  const admin = getSupabaseAdmin();
  const autoConfirm = process.env.SUPABASE_AUTO_CONFIRM === "true";

  // Check if user already exists in auth
  const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1 });
  // Actually check by email
  let userId: string;
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: email, // temp password — staff should change
      email_confirm: autoConfirm,
      ...(name ? { user_metadata: { name } } : {}),
    });
    if (error) {
      if (error.status === 422 || /already registered/i.test(error.message)) {
        return { ok: false, error: { code: "EMAIL_TAKEN", message: "Email already in use." } };
      }
      return { ok: false, error: { code: "AUTH_FAILED", message: error.message } };
    }
    if (!data.user) return { ok: false, error: { code: "AUTH_FAILED", message: "No user returned." } };
    userId = data.user.id;
    await prisma.user.create({ data: { id: userId, email, name: name ?? null } });
  }

  // Check if already a member
  const existingMembership = await prisma.membership.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
  });
  if (existingMembership) {
    return { ok: false, error: { code: "ALREADY_MEMBER", message: "This user is already a staff member." } };
  }

  const membership = await prisma.membership.create({
    data: { userId, restaurantId, role },
    select: { id: true },
  });

  return { ok: true, data: { userId, membershipId: membership.id } };
}

export async function listStaff(restaurantId: string) {
  return prisma.membership.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });
}

export async function removeStaff(
  restaurantId: string,
  membershipId: string,
): Promise<ActionResult<{ id: string }>> {
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, restaurantId },
    select: { id: true, role: true },
  });
  if (!m) return { ok: false, error: { code: "NOT_FOUND", message: "Staff member not found." } };
  if (m.role === "owner") return { ok: false, error: { code: "FORBIDDEN", message: "Cannot remove the owner." } };
  await prisma.membership.delete({ where: { id: membershipId } });
  return { ok: true, data: { id: membershipId } };
}

function validationError(err: { issues: { path: (string | number)[]; message: string }[] }) {
  return { ok: false as const, error: { code: "VALIDATION", message: "Invalid input.", fields: Object.fromEntries(err.issues.map((i) => [i.path.join("."), i.message])) } };
}
```

- [ ] **Step 4: Server action wrappers**

- [ ] **Step 5: Run tests, verify pass + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): staff invite/list/remove service + actions with TDD"
```

---

### Task 5: Staff list page + invite form

**Files:**
- Create: `apps/web/app/(admin)/staff/page.tsx`
- Create: `apps/web/components/admin/staff-list.tsx`
- Create: `apps/web/components/admin/invite-staff-dialog.tsx`

Page shows current staff with role badges. "Invite staff" button opens dialog with email + role fields. Remove button (except owner).

- [ ] **Step 1: Create page + components**
- [ ] **Step 2: Typecheck + build + commit**

```bash
pnpm typecheck
pnpm -F @app/web build
git add -A && git commit -m "feat(web): staff management page with invite + remove"
```

---

### Task 6: Role-based route protection in middleware

**Files:**
- Modify: `apps/web/middleware.ts`
- Modify: `apps/web/lib/membership.ts` (or create a new helper)

Currently all authenticated users can access all admin + station routes. Add role checks:
- `/kitchen` → requires role `kitchen`, `manager`, or `owner`
- `/bar` → requires role `bar`, `manager`, or `owner`
- `/cashier` → requires role `cashier`, `manager`, or `owner`
- `/menu`, `/tables`, `/orders`, `/staff`, `/settings`, `/reports` → requires role `owner` or `manager`

Implementation: middleware reads the user session, looks up their membership role from a lightweight query or cached JWT claim, and redirects unauthorized roles to `/dashboard` with an error.

For Phase 5, a simple approach: add a `requireRole` helper that pages call at the top of their RSC. Middleware stays unchanged (just checks auth). This is simpler than middleware-level role checks (which would need a DB call in Edge runtime — Prisma doesn't work on Edge).

- [ ] **Step 1: Create `apps/web/lib/require-role.ts`**

```ts
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/membership";
import type { Role } from "@app/db";

const STATION_ACCESS: Record<string, Role[]> = {
  kitchen: ["kitchen", "manager", "owner"],
  bar: ["bar", "manager", "owner"],
  cashier: ["cashier", "manager", "owner"],
};

const ADMIN_ROLES: Role[] = ["owner", "manager"];

export async function requireAdminRole() {
  const m = await requireMembership();
  if (!ADMIN_ROLES.includes(m.role)) redirect("/dashboard");
  return m;
}

export async function requireStationRole(station: "kitchen" | "bar" | "cashier") {
  const m = await requireMembership();
  const allowed = STATION_ACCESS[station] ?? [];
  if (!allowed.includes(m.role)) redirect("/dashboard");
  return m;
}
```

- [ ] **Step 2: Add `requireStationRole` calls in station pages**

Kitchen page: `await requireStationRole("kitchen");`
Bar page: `await requireStationRole("bar");`
Cashier page: `await requireStationRole("cashier");`

- [ ] **Step 3: Add `requireAdminRole` in admin pages that need it**

`/staff`, `/settings`, `/reports` — add `await requireAdminRole();`
(`/menu`, `/tables`, `/orders`, `/dashboard` — keep as `requireMembership()` so all staff can see them, or restrict — owner's choice. For now keep accessible to all.)

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): role-based access control for station + admin pages"
```

---

### Task 7: Sidebar — flip Staff/Reports/Settings to ready

**Files:**
- Modify: `apps/web/components/admin/sidebar.tsx`

Change `ready: false` → `ready: true` for Staff, Reports, Settings.

- [ ] **Step 1: Update sidebar**
- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "chore(web): enable Staff/Reports/Settings sidebar links"
```

---

### Task 8: Deploy + smoke test

- [ ] **Step 1: Push + deploy**

```bash
git push
npx -y vercel --prod --yes
```

- [ ] **Step 2: Smoke test**

1. `/settings` — edit restaurant name → save → verify topbar updates
2. `/dashboard` — see today's order count + revenue
3. `/reports` — see revenue chart, top items, payment split
4. `/staff` — invite a test staff member with role=kitchen → staff can log in → can access /kitchen but not /settings
5. Remove staff → they can no longer access station boards

---

## Phase 5 Acceptance

- [ ] Settings page saves and reflects changes across the app
- [ ] Dashboard shows real-time stats
- [ ] Reports page shows revenue by day, top items, payment split
- [ ] Staff invite creates a working account with role-based access
- [ ] Kitchen staff can only access /kitchen (not /bar, /settings, etc.)
- [ ] Owner can remove staff
- [ ] All previous features still work (regression)
