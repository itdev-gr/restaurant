import { prisma } from "@/lib/db";
import { UpdateRestaurantInput } from "@app/shared/zod/restaurant";
import type { ActionResult } from "@/server/actions/auth";

export async function getRestaurantSettings(restaurantId: string) {
  return prisma.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    select: {
      id: true,
      slug: true,
      name: true,
      address: true,
      currency: true,
      taxRate: true,
      serviceChargePct: true,
    },
  });
}

export async function updateRestaurantSettings(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = UpdateRestaurantInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Invalid input.",
        fields: Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join("."), i.message]),
        ),
      },
    };
  }
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      currency: parsed.data.currency,
      taxRate: parsed.data.taxRatePct,
      serviceChargePct: parsed.data.serviceChargePct,
    },
  });
  return { ok: true, data: { id: restaurantId } };
}
