import { prisma } from "@/lib/db";

export async function resetDb() {
  await prisma.$transaction([
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.restaurant.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
