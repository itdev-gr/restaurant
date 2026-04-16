import { Prisma } from "@app/db";
import { prisma } from "@/lib/db";
import { CreateOrderInput } from "@app/shared/zod/order";
import type { ActionResult } from "@/server/actions/auth";
import { generateOrderCode } from "@/lib/order-code";

const MAX_CODE_ATTEMPTS = 8;

function validationError(err: { issues: { path: (string | number)[]; message: string }[] }) {
  return {
    ok: false as const,
    error: {
      code: "VALIDATION",
      message: "Invalid input.",
      fields: Object.fromEntries(err.issues.map((i) => [i.path.join("."), i.message])),
    },
  };
}

export async function createOrder(
  restaurantId: string,
  tableId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string; code: string }>> {
  const parsed = CreateOrderInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;

  // Idempotency short-circuit
  const existing = await prisma.order.findUnique({
    where: { restaurantId_idempotencyKey: { restaurantId, idempotencyKey: input.idempotencyKey } },
    select: { id: true, code: true },
  });
  if (existing) return { ok: true, data: existing };

  // Load items restricted to this tenant
  const itemIds = input.items.map((l) => l.menuItemId);
  const items = await prisma.menuItem.findMany({
    where: { id: { in: itemIds }, restaurantId, isArchived: false, isAvailable: true },
    select: { id: true, name: true, priceCents: true, station: true },
  });
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const line of input.items) {
    if (!byId.has(line.menuItemId)) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Some items are not available." } };
    }
  }

  // Fetch tax/service from restaurant
  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    select: { taxRate: true, serviceChargePct: true },
  });

  const subtotalCents = input.items.reduce((sum, line) => {
    const it = byId.get(line.menuItemId)!;
    return sum + it.priceCents * line.qty;
  }, 0);

  const taxCents = Math.round((subtotalCents * Number(restaurant.taxRate)) / 100);
  const serviceCents = Math.round((subtotalCents * Number(restaurant.serviceChargePct)) / 100);
  const totalCents = subtotalCents + taxCents + serviceCents;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateOrderCode();
    try {
      const order = await prisma.order.create({
        data: {
          code,
          restaurantId,
          tableId,
          paymentMethod: input.paymentMethod,
          customerName: input.customerName ?? null,
          customerEmail: input.customerEmail ?? null,
          notes: input.notes ?? null,
          idempotencyKey: input.idempotencyKey,
          subtotalCents, taxCents, serviceCents, totalCents,
          items: {
            create: input.items.map((line) => {
              const it = byId.get(line.menuItemId)!;
              return {
                menuItemId: it.id,
                nameSnapshot: it.name,
                station: it.station,
                qty: line.qty,
                unitPriceCents: it.priceCents,
                lineTotalCents: it.priceCents * line.qty,
                note: line.note ?? null,
              };
            }),
          },
        },
        select: { id: true, code: true },
      });
      return { ok: true, data: order };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = (e.meta?.target as string[] | undefined) ?? [];
        if (target.includes("idempotencyKey")) {
          const row = await prisma.order.findUnique({
            where: { restaurantId_idempotencyKey: { restaurantId, idempotencyKey: input.idempotencyKey } },
            select: { id: true, code: true },
          });
          if (row) return { ok: true, data: row };
        }
        // Otherwise: code collision — retry
        continue;
      }
      throw e;
    }
  }
  return { ok: false, error: { code: "CODE_CONFLICT", message: "Could not allocate order code." } };
}

export async function getOrderByCode(restaurantId: string, code: string) {
  return prisma.order.findUnique({
    where: { restaurantId_code: { restaurantId, code } },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      table: { select: { number: true, label: true } },
    },
  });
}

export async function listOrdersForRestaurant(
  restaurantId: string,
  opts: { status?: "received" | "preparing" | "ready" | "served" | "cancelled" } = {},
) {
  return prisma.order.findMany({
    where: { restaurantId, ...(opts.status ? { status: opts.status } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      table: { select: { number: true, label: true } },
    },
    take: 100,
  });
}
