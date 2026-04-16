import { prisma } from "@/lib/db";
import {
  CreateCategoryInput,
  RenameCategoryInput,
  ReorderCategoriesInput,
} from "@app/shared/zod/category";
import type { ActionResult } from "@/server/actions/auth";

export async function listCategories(restaurantId: string) {
  return prisma.category.findMany({
    where: { restaurantId, isArchived: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, sortOrder: true, createdAt: true },
  });
}

export async function createCategory(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateCategoryInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  const sortOrder = parsed.data.sortOrder ?? (await nextSortOrder(restaurantId));

  const row = await prisma.category.create({
    data: { restaurantId, name: parsed.data.name, sortOrder },
    select: { id: true },
  });
  return { ok: true, data: { id: row.id } };
}

export async function renameCategory(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = RenameCategoryInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  const { count } = await prisma.category.updateMany({
    where: { id: parsed.data.id, restaurantId },
    data: { name: parsed.data.name },
  });
  if (count === 0) return notFound();
  return { ok: true, data: { id: parsed.data.id } };
}

export async function archiveCategory(
  restaurantId: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const { count } = await prisma.category.updateMany({
    where: { id, restaurantId },
    data: { isArchived: true },
  });
  if (count === 0) return notFound();
  return { ok: true, data: { id } };
}

export async function reorderCategories(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ updated: number }>> {
  const parsed = ReorderCategoriesInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  await prisma.$transaction(
    parsed.data.orderedIds.map((id, idx) =>
      prisma.category.updateMany({
        where: { id, restaurantId },
        data: { sortOrder: idx },
      }),
    ),
  );
  return { ok: true, data: { updated: parsed.data.orderedIds.length } };
}

async function nextSortOrder(restaurantId: string): Promise<number> {
  const top = await prisma.category.findFirst({
    where: { restaurantId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return (top?.sortOrder ?? -1) + 1;
}

function validationError(err: { issues: { path: (string | number)[]; message: string }[] }): { ok: false; error: { code: "VALIDATION"; message: string; fields: Record<string, string> } } {
  return {
    ok: false,
    error: {
      code: "VALIDATION",
      message: "Invalid input.",
      fields: Object.fromEntries(err.issues.map((i) => [i.path.join("."), i.message])),
    },
  };
}

function notFound(): { ok: false; error: { code: "NOT_FOUND"; message: string } } {
  return { ok: false, error: { code: "NOT_FOUND", message: "Category not found." } };
}
