import { describe, it, expect, beforeEach } from "vitest";
import {
  listCategories,
  createCategory,
  renameCategory,
  archiveCategory,
  reorderCategories,
} from "@/server/services/category";
import { prisma } from "@/lib/db";
import { resetDb } from "../../_helpers/db";
import { resetSupabaseAuthUsers } from "../../_helpers/supabase";

async function seedRestaurant() {
  const r = await prisma.restaurant.create({
    data: { slug: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: "R", currency: "EUR" },
    select: { id: true },
  });
  return r.id;
}

describe("category service", () => {
  beforeEach(async () => {
    await resetDb();
    await resetSupabaseAuthUsers();
  });

  it("creates a category with incremented sortOrder when unspecified", async () => {
    const rId = await seedRestaurant();
    const a = await createCategory(rId, { name: "Starters" });
    const b = await createCategory(rId, { name: "Mains" });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const aRow = await prisma.category.findUnique({ where: { id: a.data.id } });
    const bRow = await prisma.category.findUnique({ where: { id: b.data.id } });
    expect(aRow!.sortOrder).toBe(0);
    expect(bRow!.sortOrder).toBe(1);
  });

  it("lists categories scoped to restaurant, excluding archived by default", async () => {
    const r1 = await seedRestaurant();
    const r2 = await seedRestaurant();
    await createCategory(r1, { name: "A" });
    await createCategory(r1, { name: "B" });
    const archived = await createCategory(r1, { name: "C" });
    if (archived.ok) await archiveCategory(r1, archived.data.id);
    await createCategory(r2, { name: "D" });

    const list = await listCategories(r1);
    expect(list.map((c) => c.name).sort()).toEqual(["A", "B"]);
  });

  it("rename is scoped — returns NOT_FOUND when category belongs to another tenant", async () => {
    const r1 = await seedRestaurant();
    const r2 = await seedRestaurant();
    const c = await createCategory(r1, { name: "Starters" });
    if (!c.ok) return;
    const result = await renameCategory(r2, { id: c.data.id, name: "Oops" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("reorder updates sortOrder to match array index", async () => {
    const rId = await seedRestaurant();
    const a = await createCategory(rId, { name: "A" });
    const b = await createCategory(rId, { name: "B" });
    const c = await createCategory(rId, { name: "C" });
    if (!a.ok || !b.ok || !c.ok) return;
    await reorderCategories(rId, { orderedIds: [c.data.id, a.data.id, b.data.id] });
    const list = await listCategories(rId);
    expect(list.map((x) => x.name)).toEqual(["C", "A", "B"]);
  });
});
