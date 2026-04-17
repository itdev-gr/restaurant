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

async function sendBroadcast(channelName: string, event: string, payload: unknown) {
  const supa = getSupabaseAdmin();
  const channel = supa.channel(channelName);
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      supa.removeChannel(channel);
      resolve();
    }, 5000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel
          .send({ type: "broadcast", event, payload })
          .then(() => {
            clearTimeout(timeout);
            supa.removeChannel(channel);
            resolve();
          });
      }
    });
  });
}

export async function broadcastNewOrder(
  restaurantId: string,
  order: OrderBroadcast,
) {
  const kitchenItems = order.items.filter((i) => i.station !== "bar");
  const barItems = order.items.filter((i) => i.station !== "kitchen");

  const broadcasts: Promise<void>[] = [];

  if (kitchenItems.length > 0) {
    broadcasts.push(
      sendBroadcast(`restaurant:${restaurantId}:kitchen`, "order.new", {
        ...order,
        items: kitchenItems,
      }),
    );
  }

  if (barItems.length > 0) {
    broadcasts.push(
      sendBroadcast(`restaurant:${restaurantId}:bar`, "order.new", {
        ...order,
        items: barItems,
      }),
    );
  }

  broadcasts.push(
    sendBroadcast(`restaurant:${restaurantId}:cashier`, "order.new", order),
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
  const channels = ["kitchen", "bar", "cashier"];
  await Promise.allSettled(
    channels.map((ch) =>
      sendBroadcast(`restaurant:${restaurantId}:${ch}`, "item.status", update),
    ),
  );
}

export async function broadcastOrderStatusUpdate(
  restaurantId: string,
  update: {
    orderId: string;
    orderCode: string;
    status?: string;
    paymentStatus?: string;
  },
) {
  const channels = ["kitchen", "bar", "cashier"];
  await Promise.allSettled(
    channels.map((ch) =>
      sendBroadcast(
        `restaurant:${restaurantId}:${ch}`,
        "order.status",
        update,
      ),
    ),
  );
}
