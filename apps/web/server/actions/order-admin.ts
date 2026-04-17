"use server";

import { requireMembership } from "@/lib/membership";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { broadcastOrderStatusUpdate } from "@/lib/realtime";
import type { ActionResult } from "@/server/actions/auth";

type Status = "received" | "preparing" | "ready" | "served" | "cancelled";

export async function setOrderStatusAction(
  id: string,
  status: Status,
): Promise<ActionResult<{ id: string }>> {
  const { restaurantId } = await requireMembership();
  const order = await prisma.order.findFirst({
    where: { id, restaurantId },
    select: { code: true },
  });
  if (!order) return { ok: false, error: { code: "NOT_FOUND", message: "Order not found." } };

  await prisma.order.update({ where: { id }, data: { status } });

  broadcastOrderStatusUpdate(restaurantId, {
    orderId: id,
    orderCode: order.code,
    status,
  }).catch(() => {});

  return { ok: true, data: { id } };
}

export async function markOrderPaidAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const { restaurantId } = await requireMembership();
  const order = await prisma.order.findFirst({
    where: { id, restaurantId },
    select: { code: true },
  });
  if (!order) return { ok: false, error: { code: "NOT_FOUND", message: "Order not found." } };

  await prisma.order.update({
    where: { id },
    data: { paymentStatus: "paid", paidAt: new Date() },
  });

  broadcastOrderStatusUpdate(restaurantId, {
    orderId: id,
    orderCode: order.code,
    paymentStatus: "paid",
  }).catch(() => {});

  return { ok: true, data: { id } };
}

export async function refundOrderAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const { restaurantId } = await requireMembership();
  const order = await prisma.order.findFirst({
    where: { id, restaurantId, paymentMethod: "card", paymentStatus: "paid" },
    select: { stripePaymentIntentId: true },
  });
  if (!order || !order.stripePaymentIntentId) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Order not found or not refundable." } };
  }
  const stripe = getStripe();
  await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId });
  return { ok: true, data: { id } };
}
