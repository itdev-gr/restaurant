import { prisma } from "@/lib/db";

export async function listAllRestaurants() {
  return prisma.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      address: true,
      currency: true,
      taxRate: true,
      serviceChargePct: true,
      createdAt: true,
      _count: {
        select: {
          categories: true,
          menuItems: true,
          tables: { where: { isArchived: false } },
          orders: true,
          memberships: true,
        },
      },
    },
  });
}

export async function getSystemStats() {
  const [
    totalRestaurants,
    totalUsers,
    totalOrders,
    totalRevenue,
    ordersByStatus,
    ordersByPayment,
  ] = await Promise.all([
    prisma.restaurant.count(),
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { totalCents: true } }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
    prisma.order.groupBy({
      by: ["paymentMethod", "paymentStatus"],
      _count: true,
      _sum: { totalCents: true },
    }),
  ]);

  return {
    totalRestaurants,
    totalUsers,
    totalOrders,
    totalRevenueCents: totalRevenue._sum.totalCents ?? 0,
    ordersByStatus: ordersByStatus.map((s) => ({ status: s.status, count: s._count })),
    ordersByPayment: ordersByPayment.map((p) => ({
      method: p.paymentMethod,
      paymentStatus: p.paymentStatus,
      count: p._count,
      totalCents: p._sum.totalCents ?? 0,
    })),
  };
}

export async function getRestaurantDetail(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    select: {
      id: true, slug: true, name: true, address: true,
      currency: true, taxRate: true, serviceChargePct: true, createdAt: true,
    },
  });

  const [categories, menuItems, tables, orders, staff, orderAgg, statusBreakdown, paymentBreakdown] =
    await Promise.all([
      prisma.category.findMany({
        where: { restaurantId },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, isArchived: true, _count: { select: { items: true } } },
      }),
      prisma.menuItem.findMany({
        where: { restaurantId },
        orderBy: { name: "asc" },
        select: {
          id: true, name: true, priceCents: true, station: true,
          isAvailable: true, isArchived: true,
          category: { select: { name: true } },
        },
      }),
      prisma.table.findMany({
        where: { restaurantId },
        orderBy: { number: "asc" },
        select: { id: true, number: true, label: true, token: true, isArchived: true },
      }),
      prisma.order.findMany({
        where: { restaurantId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true, code: true, status: true, paymentMethod: true, paymentStatus: true,
          subtotalCents: true, taxCents: true, serviceCents: true, totalCents: true,
          customerName: true, customerEmail: true, createdAt: true,
          table: { select: { number: true, label: true } },
          items: {
            select: {
              id: true, nameSnapshot: true, qty: true, station: true,
              unitPriceCents: true, lineTotalCents: true, note: true, status: true,
            },
          },
        },
      }),
      prisma.membership.findMany({
        where: { restaurantId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true, role: true, createdAt: true,
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      prisma.order.aggregate({ where: { restaurantId }, _count: true, _sum: { totalCents: true } }),
      prisma.order.groupBy({ by: ["status"], where: { restaurantId }, _count: true }),
      prisma.order.groupBy({
        by: ["paymentMethod"],
        where: { restaurantId },
        _count: true,
        _sum: { totalCents: true },
      }),
    ]);

  return {
    restaurant,
    categories,
    menuItems,
    tables,
    orders,
    staff,
    stats: {
      totalOrders: orderAgg._count,
      totalRevenueCents: orderAgg._sum.totalCents ?? 0,
      byStatus: statusBreakdown.map((s) => ({ status: s.status, count: s._count })),
      byPayment: paymentBreakdown.map((p) => ({
        method: p.paymentMethod,
        count: p._count,
        totalCents: p._sum.totalCents ?? 0,
      })),
    },
  };
}
