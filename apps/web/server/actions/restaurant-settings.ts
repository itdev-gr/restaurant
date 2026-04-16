"use server";

import { requireMembership } from "@/lib/membership";
import { updateRestaurantSettings } from "@/server/services/restaurant-settings";

export async function updateRestaurantAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return updateRestaurantSettings(restaurantId, raw);
}
