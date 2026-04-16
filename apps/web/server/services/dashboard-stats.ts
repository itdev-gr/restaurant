import { prisma } from "@/lib/db";

export async function getDashboardStats(restaurantId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todayOrders, pendingOrders, totalTables] = await Promise.all([
    prisma.order.aggregate({
      where: { restaurantId, createdAt: { gte: startOfDay } },
      _count: true,
      _sum: { totalCents: true },
    }),
    prisma.order.count({
      where: { restaurantId, status: { in: ["received", "preparing", "ready"] } },
    }),
    prisma.table.count({
      where: { restaurantId, isArchived: false },
    }),
  ]);

  return {
    todayOrderCount: todayOrders._count,
    todayRevenueCents: todayOrders._sum.totalCents ?? 0,
    pendingOrders,
    totalTables,
  };
}
