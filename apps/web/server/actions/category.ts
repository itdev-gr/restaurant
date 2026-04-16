"use server";

import { requireMembership } from "@/lib/membership";
import {
  createCategory,
  renameCategory,
  archiveCategory,
  reorderCategories,
} from "@/server/services/category";

export async function createCategoryAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return createCategory(restaurantId, raw);
}

export async function renameCategoryAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return renameCategory(restaurantId, raw);
}

export async function archiveCategoryAction(id: string) {
  const { restaurantId } = await requireMembership();
  return archiveCategory(restaurantId, id);
}

export async function reorderCategoriesAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return reorderCategories(restaurantId, raw);
}
