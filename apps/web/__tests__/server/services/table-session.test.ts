import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "../../_helpers/db";
import { resetSupabaseAuthUsers } from "../../_helpers/supabase";
import { bulkCreateTables } from "@/server/services/table";
import { resolveTableFromToken } from "@/server/services/table-session";

async function seedWithTable(slug = "r") {
  const r = await prisma.restaurant.create({
    data: {
      slug: `${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: "R",
      currency: "EUR",
    },
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
