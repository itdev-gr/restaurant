# Restaurant Platform — Phase 4: Real-Time Station Boards

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Kitchen, Bar, and Cashier each get a live full-screen board showing incoming order items filtered by station. Orders appear in real-time via Supabase Realtime broadcast. Station staff can advance item status (received → preparing → ready → served). Audio chime on new order.

**Architecture:** Server publishes to Supabase Realtime broadcast channels after order creation. Channels are namespaced `restaurant:{restaurantId}:{station}`. Station board pages (`/kitchen`, `/bar`, `/cashier`) are admin-authed pages that subscribe to their channel on mount. Status updates from station boards call server actions that update `OrderItem.status` and re-broadcast.

**Tech Stack:** Supabase Realtime (already available via `@supabase/supabase-js`). No new deps.

---

## Tasks

### Task 1: Realtime broadcast helper (server-side publish)

**Files:**
- Create: `apps/web/lib/realtime.ts`

Server-side helper that publishes order events to Supabase Realtime channels using the admin client.

- [ ] **Step 1: Create `apps/web/lib/realtime.ts`**

```ts
import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type OrderBroadcast = {
  orderId: string;
  orderCode: string;
  tableNumber: number;
  tableLabel: string | null;
  items: {
    id: string;
    name: string;
    qty: number;
    note: string | null;
    station: "kitchen" | "bar" | "both";
    status: string;
  }[];
  paymentMethod: string;
  totalCents: number;
  createdAt: string;
};

export async function broadcastNewOrder(
  restaurantId: string,
  order: OrderBroadcast,
) {
  const supa = getSupabaseAdmin();

  const kitchenItems = order.items.filter((i) => i.station !== "bar");
  const barItems = order.items.filter((i) => i.station !== "kitchen");

  const broadcasts = [];

  if (kitchenItems.length > 0) {
    broadcasts.push(
      supa.channel(`restaurant:${restaurantId}:kitchen`).send({
        type: "broadcast",
        event: "order.new",
        payload: { ...order, items: kitchenItems },
      }),
    );
  }

  if (barItems.length > 0) {
    broadcasts.push(
      supa.channel(`restaurant:${restaurantId}:bar`).send({
        type: "broadcast",
        event: "order.new",
        payload: { ...order, items: barItems },
      }),
    );
  }

  broadcasts.push(
    supa.channel(`restaurant:${restaurantId}:cashier`).send({
      type: "broadcast",
      event: "order.new",
      payload: order,
    }),
  );

  await Promise.allSettled(broadcasts);
}

export async function broadcastItemStatusUpdate(
  restaurantId: string,
  update: { orderItemId: string; orderId: string; orderCode: string; station: string; newStatus: string },
) {
  const supa = getSupabaseAdmin();
  const channels = ["kitchen", "bar", "cashier"];
  await Promise.allSettled(
    channels.map((ch) =>
      supa.channel(`restaurant:${restaurantId}:${ch}`).send({
        type: "broadcast",
        event: "item.status",
        payload: update,
      }),
    ),
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): realtime broadcast helper for order + item-status events"
```

---

### Task 2: Wire broadcast into order creation

**Files:**
- Modify: `apps/web/server/services/order.ts` (add broadcast after successful createOrder)
- Modify: `apps/web/server/actions/order.ts` (submitOrderAction broadcasts after success)
- Modify: `apps/web/server/services/card-order.ts` (createCardOrder broadcasts after success)

After an order is successfully created, call `broadcastNewOrder` with the order data.

- [ ] **Step 1: Add broadcast to `submitOrderAction` in `apps/web/server/actions/order.ts`**

After `createOrder` succeeds, load the full order (with items + table) and broadcast:

```ts
import { broadcastNewOrder } from "@/lib/realtime";
import { prisma } from "@/lib/db";

// Inside submitOrderAction, after successful createOrder:
const fullOrder = await prisma.order.findUniqueOrThrow({
  where: { id: result.data.id },
  include: {
    items: true,
    table: { select: { number: true, label: true } },
  },
});
await broadcastNewOrder(resolved.data.restaurantId, {
  orderId: fullOrder.id,
  orderCode: fullOrder.code,
  tableNumber: fullOrder.table.number,
  tableLabel: fullOrder.table.label,
  items: fullOrder.items.map((it) => ({
    id: it.id,
    name: it.nameSnapshot,
    qty: it.qty,
    note: it.note,
    station: it.station,
    status: it.status,
  })),
  paymentMethod: fullOrder.paymentMethod,
  totalCents: fullOrder.totalCents,
  createdAt: fullOrder.createdAt.toISOString(),
});
```

- [ ] **Step 2: Same broadcast in `createCardOrder` in `apps/web/server/services/card-order.ts`**

After order + PI creation succeeds, broadcast same shape.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): broadcast new orders to kitchen/bar/cashier channels"
```

---

### Task 3: Station board page — Kitchen

**Files:**
- Create: `apps/web/app/(station)/layout.tsx` — full-screen layout (no admin sidebar)
- Create: `apps/web/app/(station)/kitchen/page.tsx`
- Create: `apps/web/components/station/station-board.tsx` — shared board component
- Create: `apps/web/components/station/ticket-card.tsx`
- Create: `apps/web/server/actions/station.ts` — updateItemStatusAction

The station board:
1. Server-renders initial tickets from DB (items for this station, status != served, recent orders)
2. Client subscribes to Supabase Realtime channel for live updates
3. New orders appear with audio chime
4. Staff clicks [Start] → [Ready] → [Served] to advance per-item status

- [ ] **Step 1: Create `apps/web/app/(station)/layout.tsx`**

```tsx
export default function StationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/server/actions/station.ts`**

```ts
"use server";

import { requireMembership } from "@/lib/membership";
import { prisma } from "@/lib/db";
import { broadcastItemStatusUpdate } from "@/lib/realtime";
import type { ActionResult } from "@/server/actions/auth";

type ItemStatus = "received" | "preparing" | "ready" | "served";

export async function updateItemStatusAction(
  orderItemId: string,
  newStatus: ItemStatus,
): Promise<ActionResult<{ id: string }>> {
  const { restaurantId } = await requireMembership();

  const item = await prisma.orderItem.findFirst({
    where: { id: orderItemId, order: { restaurantId } },
    select: { id: true, orderId: true, order: { select: { code: true } }, station: true },
  });
  if (!item) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found." } };

  await prisma.orderItem.update({
    where: { id: orderItemId },
    data: { status: newStatus },
  });

  await broadcastItemStatusUpdate(restaurantId, {
    orderItemId,
    orderId: item.orderId,
    orderCode: item.order.code,
    station: item.station,
    newStatus,
  });

  // If ALL items on this order are "served", auto-advance order status to "served"
  const remaining = await prisma.orderItem.count({
    where: { orderId: item.orderId, status: { not: "served" } },
  });
  if (remaining === 0) {
    await prisma.order.update({
      where: { id: item.orderId },
      data: { status: "served" },
    });
  }

  return { ok: true, data: { id: orderItemId } };
}
```

- [ ] **Step 3: Create `apps/web/components/station/ticket-card.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { updateItemStatusAction } from "@/server/actions/station";

type Item = {
  id: string;
  name: string;
  qty: number;
  note: string | null;
  status: "received" | "preparing" | "ready" | "served";
};

type Ticket = {
  orderId: string;
  orderCode: string;
  tableNumber: number;
  tableLabel: string | null;
  items: Item[];
  createdAt: string;
};

const NEXT_STATUS: Record<string, "preparing" | "ready" | "served" | null> = {
  received: "preparing",
  preparing: "ready",
  ready: "served",
  served: null,
};

const LABEL: Record<string, string> = {
  preparing: "Start",
  ready: "Ready",
  served: "Served",
};

export function TicketCard({
  ticket,
  onUpdated,
}: {
  ticket: Ticket;
  onUpdated: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const elapsed = Math.floor(
    (Date.now() - new Date(ticket.createdAt).getTime()) / 60_000,
  );

  const advanceItem = (itemId: string, currentStatus: string) => {
    const next = NEXT_STATUS[currentStatus];
    if (!next) return;
    startTransition(async () => {
      await updateItemStatusAction(itemId, next);
      onUpdated();
    });
  };

  const allServed = ticket.items.every((i) => i.status === "served");
  if (allServed) return null;

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="font-mono text-lg font-bold">{ticket.orderCode}</span>
          <span className="ml-2 text-sm text-slate-500">
            Table {ticket.tableLabel ?? ticket.tableNumber}
          </span>
        </div>
        <span className="text-sm text-slate-500">{elapsed}m ago</span>
      </div>
      <ul className="space-y-2">
        {ticket.items
          .filter((i) => i.status !== "served")
          .map((item) => {
            const next = NEXT_STATUS[item.status];
            return (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <div>
                  <span className="font-medium">
                    {item.qty}× {item.name}
                  </span>
                  {item.note && (
                    <span className="ml-2 text-sm text-orange-600">
                      — {item.note}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-xs">
                    {item.status}
                  </span>
                  {next && (
                    <button
                      disabled={pending}
                      onClick={() => advanceItem(item.id, item.status)}
                      className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                    >
                      {LABEL[next]}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Create `apps/web/components/station/station-board.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { TicketCard } from "./ticket-card";

type Item = {
  id: string;
  name: string;
  qty: number;
  note: string | null;
  station: "kitchen" | "bar" | "both";
  status: "received" | "preparing" | "ready" | "served";
};

type Ticket = {
  orderId: string;
  orderCode: string;
  tableNumber: number;
  tableLabel: string | null;
  items: Item[];
  paymentMethod: string;
  totalCents: number;
  createdAt: string;
};

export function StationBoard({
  station,
  restaurantId,
  initialTickets,
}: {
  station: "kitchen" | "bar" | "cashier";
  restaurantId: string;
  initialTickets: Ticket[];
}) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    audioRef.current = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1iZ2hnaWRcT0E3My81OUBIUFhfZ29ze4OHi46Pk5aXl5aUkY6KhYF8d3JuamZjYF5cW1pbXF5hZGhtcnh+g4mOkpaZm5ybnJqXlJCMh4J9eHNuamViX11bWltcXmFlaW1yeH6EiY6TlpmbnZ2cm5mWk4+LhoF8d3JuamViX11bWltcXmFlam5zeX+EiY+TlpmbnZ2cm5mWk4+LhoF8d3JuamViXw=="
    );
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`restaurant:${restaurantId}:${station}`)
      .on("broadcast", { event: "order.new" }, ({ payload }) => {
        setTickets((prev) => [payload as Ticket, ...prev]);
        audioRef.current?.play().catch(() => {});
      })
      .on("broadcast", { event: "item.status" }, ({ payload }) => {
        const p = payload as { orderItemId: string; newStatus: string };
        setTickets((prev) =>
          prev.map((t) => ({
            ...t,
            items: t.items.map((i) =>
              i.id === p.orderItemId
                ? { ...i, status: p.newStatus as Item["status"] }
                : i,
            ),
          })),
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, station]);

  // Re-fetch on manual refresh (for status updates triggered by this station)
  useEffect(() => {
    if (refreshKey === 0) return;
    // After a local status update, just re-render (state already updated via broadcast)
  }, [refreshKey]);

  const active = tickets.filter((t) =>
    t.items.some((i) => i.status !== "served"),
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold capitalize">{station}</h1>
        <span className="rounded-full bg-brand-500 px-3 py-1 text-sm font-medium text-white">
          {active.length} active
        </span>
      </div>
      {active.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center text-lg text-slate-400">
          No pending orders. Waiting for new orders…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((t) => (
            <TicketCard key={t.orderId} ticket={t} onUpdated={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `apps/web/app/(station)/kitchen/page.tsx`**

```tsx
import { requireMembership } from "@/lib/membership";
import { prisma } from "@/lib/db";
import { StationBoard } from "@/components/station/station-board";

export const metadata = { title: "Kitchen" };
export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const { restaurantId } = await requireMembership();

  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      status: { in: ["received", "preparing", "ready"] },
      items: { some: { station: { in: ["kitchen", "both"] }, status: { not: "served" } } },
    },
    orderBy: { createdAt: "asc" },
    include: {
      items: { where: { station: { in: ["kitchen", "both"] } } },
      table: { select: { number: true, label: true } },
    },
    take: 50,
  });

  const tickets = orders.map((o) => ({
    orderId: o.id,
    orderCode: o.code,
    tableNumber: o.table.number,
    tableLabel: o.table.label,
    items: o.items.map((i) => ({
      id: i.id,
      name: i.nameSnapshot,
      qty: i.qty,
      note: i.note,
      station: i.station as "kitchen" | "bar" | "both",
      status: i.status as "received" | "preparing" | "ready" | "served",
    })),
    paymentMethod: o.paymentMethod,
    totalCents: o.totalCents,
    createdAt: o.createdAt.toISOString(),
  }));

  return <StationBoard station="kitchen" restaurantId={restaurantId} initialTickets={tickets} />;
}
```

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): kitchen station board with realtime subscription + per-item status"
```

---

### Task 4: Bar + Cashier board pages

**Files:**
- Create: `apps/web/app/(station)/bar/page.tsx`
- Create: `apps/web/app/(station)/cashier/page.tsx`

Same pattern as kitchen, with different station filters.

- [ ] **Step 1: Create `apps/web/app/(station)/bar/page.tsx`**

Same as kitchen but filter by `station: { in: ["bar", "both"] }` and render `<StationBoard station="bar" ...>`.

- [ ] **Step 2: Create `apps/web/app/(station)/cashier/page.tsx`**

Cashier sees ALL items (no station filter). Include payment info. Render `<StationBoard station="cashier" ...>`.

- [ ] **Step 3: Typecheck + build + commit**

```bash
pnpm typecheck
pnpm -F @app/web build
git add -A && git commit -m "feat(web): bar + cashier station boards"
```

---

### Task 5: Wire station links in admin + middleware

**Files:**
- Modify: `apps/web/components/admin/sidebar.tsx` — add Kitchen/Bar/Cashier links (or add them as separate full-screen nav)
- Modify: `apps/web/middleware.ts` — protect `/kitchen`, `/bar`, `/cashier` routes

Since station boards are full-screen (no sidebar), add a simple nav bar within the (station) layout:

- [ ] **Step 1: Update `apps/web/app/(station)/layout.tsx`**

Add a minimal top bar with links to all 3 stations + back to admin:

```tsx
import Link from "next/link";

export default function StationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="flex items-center gap-4 border-b bg-white px-4 py-2 text-sm">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-700">← Admin</Link>
        <Link href="/kitchen" className="font-medium text-slate-700 hover:text-brand-600">Kitchen</Link>
        <Link href="/bar" className="font-medium text-slate-700 hover:text-brand-600">Bar</Link>
        <Link href="/cashier" className="font-medium text-slate-700 hover:text-brand-600">Cashier</Link>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Update `apps/web/middleware.ts`**

Add `/kitchen`, `/bar`, `/cashier` to the PROTECTED regex array so unauthenticated users are redirected to login.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): station layout nav + protect station routes in middleware"
```

---

### Task 6: Deploy + smoke test

- [ ] **Step 1: Push + deploy**

```bash
git push
npx -y vercel --prod --yes
```

- [ ] **Step 2: Smoke test**

1. Sign in as admin
2. Open `/kitchen` in one tab, `/bar` in another, `/cashier` in a third
3. Open customer menu in an incognito window, add items (one kitchen, one bar)
4. Submit cash order
5. All 3 station boards should show the new ticket in real-time (with audio chime)
6. Kitchen board: click "Start" on the food item → status changes to "preparing"
7. Click "Ready" → "Served" → item disappears from kitchen board
8. Bar board: same for drink items
9. Cashier board: see full order, all items, payment status
10. When all items are served, order auto-advances to "served"

---

## Phase 4 Acceptance

- [ ] New orders appear on station boards in real-time (no page refresh)
- [ ] Audio chime plays on new order
- [ ] Kitchen only sees kitchen+both items
- [ ] Bar only sees bar+both items
- [ ] Cashier sees all items + payment info
- [ ] Per-item status advancement works (received → preparing → ready → served)
- [ ] Auto-archive: tickets with all items served disappear
- [ ] Order auto-advances to "served" when all items are served
- [ ] All Phase 2/3 tests still pass
- [ ] Cash + card ordering still work (regression)
