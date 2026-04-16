import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "../../_helpers/db";
import { resetSupabaseAuthUsers } from "../../_helpers/supabase";
import {
  listTables,
  bulkCreateTables,
  renameTable,
  archiveTable,
} from "@/server/services/table";

async function seedRestaurant() {
  const r = await prisma.restaurant.create({
    data: { slug: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: "R", currency: "EUR" },
    select: { id: true },
  });
  return r.id;
}

describe("table service", () => {
  beforeEach(async () => {
    await resetDb();
    await resetSupabaseAuthUsers();
  });

  it("bulk-creates N tables numbered 1..N with unique 16-char tokens", async () => {
    const rId = await seedRestaurant();
    const r = await bulkCreateTables(rId, { count: 10 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.count).toBe(10);
    const tables = await prisma.table.findMany({ where: { restaurantId: rId }, orderBy: { number: "asc" } });
    expect(tables.map((t) => t.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const t of tables) {
      expect(t.token).toMatch(/^[A-Za-z0-9_-]{16}$/);
    }
    const uniqueTokens = new Set(tables.map((t) => t.token));
    expect(uniqueTokens.size).toBe(10);
  });

  it("bulk-create respects startAt and skips existing numbers", async () => {
    const rId = await seedRestaurant();
    await bulkCreateTables(rId, { count: 3 });           // 1,2,3
    const r = await bulkCreateTables(rId, { count: 2, startAt: 10 }); // 10,11
    expect(r.ok).toBe(true);
    const tables = await prisma.table.findMany({ where: { restaurantId: rId }, orderBy: { number: "asc" } });
    expect(tables.map((t) => t.number)).toEqual([1, 2, 3, 10, 11]);
  });

  it("listTables scopes to tenant, excludes archived", async () => {
    const r1 = await seedRestaurant();
    const r2 = await seedRestaurant();
    await bulkCreateTables(r1, { count: 2 });
    await bulkCreateTables(r2, { count: 3 });
    const one = await prisma.table.findFirst({ where: { restaurantId: r1 } });
    if (one) await archiveTable(r1, one.id);
    const list = await listTables(r1);
    expect(list).toHaveLength(1);
  });

  it("rename updates the label", async () => {
    const rId = await seedRestaurant();
    await bulkCreateTables(rId, { count: 1 });
    const t = await prisma.table.findFirstOrThrow({ where: { restaurantId: rId } });
    const r = await renameTable(rId, { id: t.id, label: "Patio 1" });
    expect(r.ok).toBe(true);
    const after = await prisma.table.findUnique({ where: { id: t.id } });
    expect(after!.label).toBe("Patio 1");
  });

  it("archive is scoped", async () => {
    const r1 = await seedRestaurant();
    const r2 = await seedRestaurant();
    await bulkCreateTables(r1, { count: 1 });
    const t = await prisma.table.findFirstOrThrow({ where: { restaurantId: r1 } });
    const wrong = await archiveTable(r2, t.id);
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe("NOT_FOUND");
  });
});
