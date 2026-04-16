import { requireMembership } from "@/lib/membership";
import { listOrdersForRestaurant } from "@/server/services/order";
import { OrdersList } from "@/components/admin/orders-list";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { restaurantId } = await requireMembership();
  const orders = await listOrdersForRestaurant(restaurantId);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Orders</h1>
      <OrdersList
        orders={orders.map((o) => ({
          id: o.id,
          code: o.code,
          status: o.status,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          total: o.totalCents,
          createdAt: o.createdAt.toISOString(),
          tableLabel: o.table.label ?? `Table ${o.table.number}`,
          items: o.items.map((it) => ({
            id: it.id,
            qty: it.qty,
            name: it.nameSnapshot,
            station: it.station,
            note: it.note,
            status: it.status,
          })),
        }))}
      />
    </div>
  );
}
