"use server";

import type { ActionResult } from "@/server/actions/auth";
import { getSessionUser } from "@/lib/auth-helpers";
import { createRestaurantForUser } from "@/server/services/restaurant";

export async function createRestaurantAction(
  raw: unknown,
): Promise<ActionResult<{ restaurantId: string; slug: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: { code: "UNAUTHENTICATED", message: "Not signed in." } };
  return createRestaurantForUser(user.id, raw);
}
