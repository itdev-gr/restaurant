import { z } from "zod";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/server/actions/auth";

export const MAX_IMAGES_PER_ITEM = 3;

const AttachInput = z.object({
  itemId: z.string(),
  path: z.string().min(1).max(200),
});

export async function listItemImages(restaurantId: string, itemId: string) {
  const ownedItem = await prisma.menuItem.findFirst({
    where: { id: itemId, restaurantId },
    select: { id: true },
  });
  if (!ownedItem) return [];
  return prisma.menuItemImage.findMany({
    where: { menuItemId: itemId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, path: true, sortOrder: true },
  });
}

export async function attachImage(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = AttachInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const { itemId, path } = parsed.data;

  const item = await prisma.menuItem.findFirst({
    where: { id: itemId, restaurantId },
    select: { id: true, _count: { select: { images: true } } },
  });
  if (!item) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found." } };
  if (item._count.images >= MAX_IMAGES_PER_ITEM) {
    return { ok: false, error: { code: "LIMIT_REACHED", message: `Max ${MAX_IMAGES_PER_ITEM} images per item.` } };
  }

  const row = await prisma.menuItemImage.create({
    data: { menuItemId: itemId, path, sortOrder: item._count.images },
    select: { id: true },
  });
  return { ok: true, data: { id: row.id } };
}

export async function removeImage(
  restaurantId: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const owned = await prisma.menuItemImage.findFirst({
    where: { id, menuItem: { restaurantId } },
    select: { id: true, path: true },
  });
  if (!owned) return { ok: false, error: { code: "NOT_FOUND", message: "Image not found." } };
  await prisma.menuItemImage.delete({ where: { id } });
  return { ok: true, data: { id } };
}

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
