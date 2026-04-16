import { prisma } from "@/lib/db";
import type { ActionResult } from "@/server/actions/auth";

type Resolved = {
  restaurantId: string;
  tableId: string;
  restaurant: {
    id: string;
    slug: string;
    name: string;
    currency: string;
    taxRate: string;
    serviceChargePct: string;
  };
  table: { id: string; number: number; label: string | null };
};

export async function resolveTableFromToken(
  slug: string,
  token: string,
): Promise<ActionResult<Resolved>> {
  const table = await prisma.table.findUnique({
    where: { token },
    include: {
      restaurant: {
        select: {
          id: true,
          slug: true,
          name: true,
          currency: true,
          taxRate: true,
          serviceChargePct: true,
        },
      },
    },
  });
  if (!table || table.restaurant.slug !== slug) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Table not found." } };
  }
  if (table.isArchived) {
    return { ok: false, error: { code: "ARCHIVED", message: "This table is no longer active." } };
  }
  return {
    ok: true,
    data: {
      restaurantId: table.restaurantId,
      tableId: table.id,
      restaurant: {
        id: table.restaurant.id,
        slug: table.restaurant.slug,
        name: table.restaurant.name,
        currency: table.restaurant.currency,
        taxRate: table.restaurant.taxRate.toString(),
        serviceChargePct: table.restaurant.serviceChargePct.toString(),
      },
      table: { id: table.id, number: table.number, label: table.label },
    },
  };
}
