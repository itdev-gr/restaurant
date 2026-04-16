import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "../../_helpers/db";
import { resetSupabaseAuthUsers } from "../../_helpers/supabase";
import { createCategory } from "@/server/services/category";
import { createItem } from "@/server/services/menu-item";
import {
  attachImage,
  removeImage,
  listItemImages,
  MAX_IMAGES_PER_ITEM,
} from "@/server/services/menu-item-image";

async function seedItem() {
  const r = await prisma.restaurant.create({
    data: { slug: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: "R", currency: "EUR" },
    select: { id: true },
  });
  const cat = await createCategory(r.id, { name: "Starters" });
  if (!cat.ok) throw new Error();
  const item = await createItem(r.id, {
    categoryId: cat.data.id, name: "X", priceCents: 100, station: "kitchen",
  });
  if (!item.ok) throw new Error();
  return { restaurantId: r.id, itemId: item.data.id };
}

describe("menu-item-image service", () => {
  beforeEach(async () => {
    await resetDb();
    await resetSupabaseAuthUsers();
  });

  it("attaches an image record", async () => {
    const { restaurantId, itemId } = await seedItem();
    const r = await attachImage(restaurantId, { itemId, path: "rest/item/1.jpg" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const list = await listItemImages(restaurantId, itemId);
    expect(list).toHaveLength(1);
    expect(list[0]!.path).toBe("rest/item/1.jpg");
  });

  it("enforces MAX_IMAGES_PER_ITEM", async () => {
    const { restaurantId, itemId } = await seedItem();
    for (let i = 0; i < MAX_IMAGES_PER_ITEM; i++) {
      await attachImage(restaurantId, { itemId, path: `p/${i}.jpg` });
    }
    const over = await attachImage(restaurantId, { itemId, path: "p/extra.jpg" });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.code).toBe("LIMIT_REACHED");
  });

  it("scopes removal to tenant", async () => {
    const a = await seedItem();
    const b = await seedItem();
    const add = await attachImage(a.restaurantId, { itemId: a.itemId, path: "a/1.jpg" });
    if (!add.ok) return;
    const wrong = await removeImage(b.restaurantId, add.data.id);
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe("NOT_FOUND");
  });
});
