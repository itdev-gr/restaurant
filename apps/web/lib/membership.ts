import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";

export async function requireMembership() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const m = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { restaurantId: true, role: true },
  });
  if (!m) redirect("/onboarding");
  return { user, restaurantId: m.restaurantId, role: m.role };
}
