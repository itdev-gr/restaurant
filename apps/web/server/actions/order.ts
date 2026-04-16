"use server";

import { resolveTableFromToken } from "@/server/services/table-session";
import { createOrder } from "@/server/services/order";
import { broadcastNewOrder } from "@/lib/realtime";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/server/actions/auth";

export async function submitOrderAction(
  slug: string,
  token: string,
  raw: unknown,
): Promise<ActionResult<{ code: string }>> {
  const resolved = await resolveTableFromToken(slug, token);
  if (!resolved.ok) {
    return {
      ok: false,
      error: { code: "NO_SESSION", message: "Table not available. Rescan the QR code." },
    };
  }
  const result = await createOrder(resolved.data.restaurantId, resolved.data.tableId, raw);
  if (!result.ok) return result;

  // Best-effort broadcast to kitchen/bar/cashier station boards
  prisma.order
    .findUniqueOrThrow({
      where: { id: result.data.id },
      include: {
        items: true,
        table: { select: { number: true, label: true } },
      },
    })
    .then((fullOrder) =>
      broadcastNewOrder(resolved.data.restaurantId, {
        orderId: fullOrder.id,
        orderCode: fullOrder.code,
        tableNumber: fullOrder.table.number,
        tableLabel: fullOrder.table.label,
        items: fullOrder.items.map((it) => ({
          id: it.id,
          name: it.nameSnapshot,
          qty: it.qty,
          note: it.note,
          station: it.station,
          status: it.status,
        })),
        paymentMethod: fullOrder.paymentMethod,
        totalCents: fullOrder.totalCents,
        createdAt: fullOrder.createdAt.toISOString(),
      }),
    )
    .catch(() => {});

  return { ok: true, data: { code: result.data.code } };
}
