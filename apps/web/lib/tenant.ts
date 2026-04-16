import { getSessionUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";

export async function currentRestaurantId(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const m = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { restaurantId: true },
  });
  return m?.restaurantId ?? null;
}
