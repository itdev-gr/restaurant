"use server";

import { requireMembership } from "@/lib/membership";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/server/actions/auth";

type Status = "received" | "preparing" | "ready" | "served" | "cancelled";

export async function setOrderStatusAction(
  id: string,
  status: Status,
): Promise<ActionResult<{ id: string }>> {
  const { restaurantId } = await requireMembership();
  const { count } = await prisma.order.updateMany({
    where: { id, restaurantId },
    data: { status },
  });
  if (count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Order not found." } };
  return { ok: true, data: { id } };
}

export async function markOrderPaidAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const { restaurantId } = await requireMembership();
  const { count } = await prisma.order.updateMany({
    where: { id, restaurantId },
    data: { paymentStatus: "paid", paidAt: new Date() },
  });
  if (count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Order not found." } };
  return { ok: true, data: { id } };
}
