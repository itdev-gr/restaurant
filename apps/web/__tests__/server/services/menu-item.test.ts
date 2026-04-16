import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "../../_helpers/db";
import { resetSupabaseAuthUsers } from "../../_helpers/supabase";
import { createCategory } from "@/server/services/category";
import {
  listItems,
  createItem,
  updateItem,
  setAvailability,
  archiveItem,
} from "@/server/services/menu-item";

async function seed() {
  const r = await prisma.restaurant.create({
    data: { slug: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: "R", currency: "EUR" },
    select: { id: true },
  });
  const cat = await createCategory(r.id, { name: "Starters" });
  if (!cat.ok) throw new Error("seed failed");
  return { restaurantId: r.id, categoryId: cat.data.id };
}

describe("menu-item service", () => {
  beforeEach(async () => {
    await resetDb();
    await resetSupabaseAuthUsers();
  });

  it("creates an item in a category", async () => {
    const { restaurantId, categoryId } = await seed();
    const r = await createItem(restaurantId, {
      categoryId, name: "Bruschetta", priceCents: 650, station: "kitchen",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const row = await prisma.menuItem.findUnique({ where: { id: r.data.id } });
    expect(row!.priceCents).toBe(650);
    expect(row!.station).toBe("kitchen");
    expect(row!.isAvailable).toBe(true);
  });

  it("rejects creating an item in another tenant's category", async () => {
    const a = await seed();
    const b = await seed();
    const r = await createItem(a.restaurantId, {
      categoryId: b.categoryId,
      name: "X", priceCents: 100, station: "kitchen",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("lists items for a restaurant, skipping archived", async () => {
    const { restaurantId, categoryId } = await seed();
    const a = await createItem(restaurantId, { categoryId, name: "A", priceCents: 100, station: "kitchen" });
    const b = await createItem(restaurantId, { categoryId, name: "B", priceCents: 200, station: "bar" });
    if (a.ok) await archiveItem(restaurantId, a.data.id);
    const list = await listItems(restaurantId, { categoryId });
    expect(list.map((i) => i.name)).toEqual(["B"]);
  });

  it("setAvailability toggles flag", async () => {
    const { restaurantId, categoryId } = await seed();
    const r = await createItem(restaurantId, { categoryId, name: "X", priceCents: 100, station: "kitchen" });
    if (!r.ok) return;
    await setAvailability(restaurantId, { id: r.data.id, isAvailable: false });
    const row = await prisma.menuItem.findUnique({ where: { id: r.data.id } });
    expect(row!.isAvailable).toBe(false);
  });

  it("update validates + scopes to tenant", async () => {
    const a = await seed();
    const b = await seed();
    const item = await createItem(a.restaurantId, {
      categoryId: a.categoryId, name: "A", priceCents: 100, station: "kitchen",
    });
    if (!item.ok) return;
    const wrong = await updateItem(b.restaurantId, { id: item.data.id, name: "Hacked" });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe("NOT_FOUND");
  });
});
