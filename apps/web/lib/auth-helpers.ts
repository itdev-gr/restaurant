import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/db";

export async function getSessionUser() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireSession() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRestaurant() {
  const user = await requireSession();
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { restaurantId: true, role: true, restaurant: { select: { name: true, slug: true } } },
  });
  if (!membership) redirect("/onboarding");
  return { user, restaurantId: membership.restaurantId, role: membership.role, restaurant: membership.restaurant };
}
