import { notFound } from "next/navigation";
import { resolveTableFromToken } from "@/server/services/table-session";
import { getOrderByCode } from "@/server/services/order";
import { OrderStatus } from "@/components/customer/order-status";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: { params: { slug: string; token: string; code: string } }) {
  const resolved = await resolveTableFromToken(params.slug, params.token);
  if (!resolved.ok) notFound();
  const order = await getOrderByCode(resolved.data.restaurantId, params.code);
  if (!order) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-4 py-3">
        <h1 className="text-lg font-semibold">Order {order.code}</h1>
        <div className="text-xs text-slate-500">
          Table {order.table.label ?? order.table.number} · {resolved.data.restaurant.name}
        </div>
      </header>
      <main className="space-y-4 p-4">
        <OrderStatus
          status={order.status}
          paymentMethod={order.paymentMethod}
          paymentStatus={order.paymentStatus}
        />
        <section className="rounded-lg border bg-white p-4">
          <ul className="space-y-2 text-sm">
            {order.items.map((it) => (
              <li key={it.id} className="flex justify-between">
                <span>
                  {it.qty}× {it.nameSnapshot}
                  {it.note ? ` — ${it.note}` : ""}
                </span>
                <span>€{(it.lineTotalCents / 100).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <hr className="my-3" />
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span>€{(order.subtotalCents / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Tax</span>
            <span>€{(order.taxCents / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Service</span>
            <span>€{(order.serviceCents / 100).toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>€{(order.totalCents / 100).toFixed(2)}</span>
          </div>
        </section>
      </main>
    </div>
  );
}
