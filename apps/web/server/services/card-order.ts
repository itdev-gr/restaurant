import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { createOrder } from "@/server/services/order";
import { resolveTableFromToken } from "@/server/services/table-session";
import type { ActionResult } from "@/server/actions/auth";

export async function createCardOrder(
  slug: string,
  token: string,
  raw: unknown,
): Promise<ActionResult<{ orderCode: string; clientSecret: string }>> {
  const resolved = await resolveTableFromToken(slug, token);
  if (!resolved.ok) {
    return { ok: false, error: { code: "NO_SESSION", message: "Table not available." } };
  }

  const orderResult = await createOrder(resolved.data.restaurantId, resolved.data.tableId, raw);
  if (!orderResult.ok) return orderResult;

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderResult.data.id },
    select: { id: true, code: true, totalCents: true, customerEmail: true },
  });

  const stripe = getStripe();
  const pi = await stripe.paymentIntents.create({
    amount: order.totalCents,
    currency: resolved.data.restaurant.currency.toLowerCase(),
    metadata: {
      orderId: order.id,
      restaurantId: resolved.data.restaurantId,
      orderCode: order.code,
    },
    ...(order.customerEmail ? { receipt_email: order.customerEmail } : {}),
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { stripePaymentIntentId: pi.id },
  });

  return {
    ok: true,
    data: { orderCode: order.code, clientSecret: pi.client_secret! },
  };
}
