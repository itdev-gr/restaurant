import { prisma } from "@/lib/db";
import type { Prisma } from "@app/db";
import {
  CreateMenuItemInput,
  UpdateMenuItemInput,
  SetAvailabilityInput,
} from "@app/shared/zod/menu-item";
import type { ActionResult } from "@/server/actions/auth";

type ListFilters = { categoryId?: string; includeArchived?: boolean };

export async function listItems(restaurantId: string, filters: ListFilters = {}) {
  const where: Prisma.MenuItemWhereInput = {
    restaurantId,
    ...(filters.includeArchived ? {} : { isArchived: false }),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
  };
  return prisma.menuItem.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, name: true, description: true, priceCents: true,
      station: true, isAvailable: true, categoryId: true, sortOrder: true,
      images: { select: { id: true, path: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function createItem(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateMenuItemInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const { categoryId, name, description, priceCents, station } = parsed.data;

  const cat = await prisma.category.findFirst({
    where: { id: categoryId, restaurantId },
    select: { id: true },
  });
  if (!cat) return { ok: false, error: { code: "NOT_FOUND", message: "Category not found." } };

  const row = await prisma.menuItem.create({
    data: {
      restaurantId, categoryId, name,
      description: description ?? null,
      priceCents, station,
    },
    select: { id: true },
  });
  return { ok: true, data: { id: row.id } };
}

export async function updateItem(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = UpdateMenuItemInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  if (parsed.data.categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, restaurantId },
      select: { id: true },
    });
    if (!cat) return { ok: false, error: { code: "NOT_FOUND", message: "Category not found." } };
  }

  const { id, ...updates } = parsed.data;
  const data: Prisma.MenuItemUpdateManyMutationInput & Prisma.MenuItemUncheckedUpdateManyInput = {};
  if (updates.categoryId !== undefined) data.categoryId = updates.categoryId;
  if (updates.name !== undefined) data.name = updates.name;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.priceCents !== undefined) data.priceCents = updates.priceCents;
  if (updates.station !== undefined) data.station = updates.station;

  const { count } = await prisma.menuItem.updateMany({
    where: { id, restaurantId },
    data,
  });
  if (count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found." } };
  return { ok: true, data: { id } };
}

export async function setAvailability(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = SetAvailabilityInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const { count } = await prisma.menuItem.updateMany({
    where: { id: parsed.data.id, restaurantId },
    data: { isAvailable: parsed.data.isAvailable },
  });
  if (count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found." } };
  return { ok: true, data: { id: parsed.data.id } };
}

export async function archiveItem(
  restaurantId: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const { count } = await prisma.menuItem.updateMany({
    where: { id, restaurantId },
    data: { isArchived: true },
  });
  if (count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found." } };
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
