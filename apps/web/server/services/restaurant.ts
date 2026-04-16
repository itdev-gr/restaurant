import { CreateRestaurantInput } from "@app/shared/zod/restaurant";
import { prisma } from "@/lib/db";
import { generateUniqueSlug } from "@/lib/slug";
import type { ActionResult } from "@/server/actions/auth";

export async function createRestaurantForUser(
  userId: string,
  raw: unknown,
): Promise<ActionResult<{ restaurantId: string; slug: string }>> {
  const parsed = CreateRestaurantInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Invalid input.",
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      },
    };
  }
  const { name, address, currency, taxRatePct, serviceChargePct } = parsed.data;

  const slug = await generateUniqueSlug(name, async (s) =>
    Boolean(await prisma.restaurant.findUnique({ where: { slug: s }, select: { id: true } })),
  );

  const restaurant = await prisma.restaurant.create({
    data: {
      slug,
      name,
      address: address ?? null,
      currency,
      taxRate: taxRatePct,
      serviceChargePct,
      memberships: { create: { userId, role: "owner" } },
    },
    select: { id: true, slug: true },
  });

  return { ok: true, data: { restaurantId: restaurant.id, slug: restaurant.slug } };
}
