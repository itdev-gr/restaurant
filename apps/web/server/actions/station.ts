"use server";

import { requireMembership } from "@/lib/membership";
import { prisma } from "@/lib/db";
import { broadcastItemStatusUpdate } from "@/lib/realtime";
import type { ActionResult } from "@/server/actions/auth";

type ItemStatus = "received" | "preparing" | "ready" | "served";

export async function updateItemStatusAction(
  orderItemId: string,
  newStatus: ItemStatus,
): Promise<ActionResult<{ id: string }>> {
  const { restaurantId } = await requireMembership();

  const item = await prisma.orderItem.findFirst({
    where: { id: orderItemId, order: { restaurantId } },
    select: { id: true, orderId: true, order: { select: { code: true } }, station: true },
  });
  if (!item) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found." } };

  await prisma.orderItem.update({
    where: { id: orderItemId },
    data: { status: newStatus },
  });

  await broadcastItemStatusUpdate(restaurantId, {
    orderItemId,
    orderId: item.orderId,
    orderCode: item.order.code,
    station: item.station,
    newStatus,
  }).catch(() => {});

  // Auto-advance order to "served" when all items served
  const remaining = await prisma.orderItem.count({
    where: { orderId: item.orderId, status: { not: "served" } },
  });
  if (remaining === 0) {
    await prisma.order.update({
      where: { id: item.orderId },
      data: { status: "served" },
    });
  }

  return { ok: true, data: { id: orderItemId } };
}
