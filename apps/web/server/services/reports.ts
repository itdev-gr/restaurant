import { prisma } from "@/lib/db";

export async function getRevenueByDay(restaurantId: string, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: { restaurantId, createdAt: { gte: since } },
    select: { createdAt: true, totalCents: true },
  });

  const byDay: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    byDay[d.toISOString().slice(0, 10)] = 0;
  }
  for (const o of orders) {
    const key = o.createdAt.toISOString().slice(0, 10);
    if (key in byDay) byDay[key] = (byDay[key] ?? 0) + o.totalCents;
  }
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cents]) => ({ date, cents }));
}

export async function getTopItems(restaurantId: string, limit = 5) {
  const items = await prisma.orderItem.groupBy({
    by: ["nameSnapshot"],
    where: { order: { restaurantId } },
    _sum: { qty: true },
    orderBy: { _sum: { qty: "desc" } },
    take: limit,
  });
  return items.map((i) => ({ name: i.nameSnapshot, qty: i._sum.qty ?? 0 }));
}

export async function getPaymentSplit(restaurantId: string) {
  const orders = await prisma.order.groupBy({
    by: ["paymentMethod"],
    where: { restaurantId },
    _count: true,
    _sum: { totalCents: true },
  });
  return orders.map((g) => ({
    method: g.paymentMethod,
    count: g._count,
    totalCents: g._sum.totalCents ?? 0,
  }));
}
