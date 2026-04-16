"use server";

import { requireMembership } from "@/lib/membership";
import {
  createItem, updateItem, setAvailability, archiveItem,
} from "@/server/services/menu-item";

export async function createItemAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return createItem(restaurantId, raw);
}

export async function updateItemAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return updateItem(restaurantId, raw);
}

export async function setAvailabilityAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return setAvailability(restaurantId, raw);
}

export async function archiveItemAction(id: string) {
  const { restaurantId } = await requireMembership();
  return archiveItem(restaurantId, id);
}
