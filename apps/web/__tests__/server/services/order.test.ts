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
    data: {
      slug: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: "R", currency: "EUR", taxRate: 13, serviceChargePct: 10,
    },
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
  // UUID v4 pattern
  const hex = "abcdef0123456789";
  const pick = (n: number) => Array.from({ length: n }, () => hex[Math.floor(Math.random() * 16)]).join("");
  return `${pick(8)}-${pick(4)}-4${pick(3)}-8${pick(3)}-${pick(12)}`;
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
    expect(row.taxCents).toBe(169);
    expect(row.serviceCents).toBe(130);
    expect(row.totalCents).toBe(1599);
    expect(row.paymentMethod).toBe("cash");
    expect(row.status).toBe("received");
    expect(row.paymentStatus).toBe("unpaid");
    expect(row.code).toMatch(/^[A-HJ-NP-Z][0-9]{3}$/);
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
