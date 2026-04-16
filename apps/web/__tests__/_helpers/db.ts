import { prisma } from "@/lib/db";

export async function resetDb() {
  await prisma.$transaction([
    prisma.membership.deleteMany(),
    prisma.restaurant.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
