import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type OrderBroadcast = {
  orderId: string;
  orderCode: string;
  tableNumber: number;
  tableLabel: string | null;
  items: {
    id: string;
    name: string;
    qty: number;
    note: string | null;
    station: "kitchen" | "bar" | "both";
    status: string;
  }[];
  paymentMethod: string;
  totalCents: number;
  createdAt: string;
};

export async function broadcastNewOrder(
  restaurantId: string,
  order: OrderBroadcast,
) {
  const supa = getSupabaseAdmin();

  const kitchenItems = order.items.filter((i) => i.station !== "bar");
  const barItems = order.items.filter((i) => i.station !== "kitchen");

  const broadcasts = [];

  if (kitchenItems.length > 0) {
    broadcasts.push(
      supa.channel(`restaurant:${restaurantId}:kitchen`).send({
        type: "broadcast",
        event: "order.new",
        payload: { ...order, items: kitchenItems },
      }),
    );
  }

  if (barItems.length > 0) {
    broadcasts.push(
      supa.channel(`restaurant:${restaurantId}:bar`).send({
        type: "broadcast",
        event: "order.new",
        payload: { ...order, items: barItems },
      }),
    );
  }

  broadcasts.push(
    supa.channel(`restaurant:${restaurantId}:cashier`).send({
      type: "broadcast",
      event: "order.new",
      payload: order,
    }),
  );

  await Promise.allSettled(broadcasts);
}

export async function broadcastItemStatusUpdate(
  restaurantId: string,
  update: {
    orderItemId: string;
    orderId: string;
    orderCode: string;
    station: string;
    newStatus: string;
  },
) {
  const supa = getSupabaseAdmin();
  const channels = ["kitchen", "bar", "cashier"];
  await Promise.allSettled(
    channels.map((ch) =>
      supa.channel(`restaurant:${restaurantId}:${ch}`).send({
        type: "broadcast",
        event: "item.status",
        payload: update,
      }),
    ),
  );
}
