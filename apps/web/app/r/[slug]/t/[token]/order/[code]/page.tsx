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
      <header className="customer-header-gradient px-5 pb-5 pt-safe-top">
        <div className="pt-4">
          <div className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            Order {order.code}
          </div>
          <h1 className="mt-2 text-xl font-bold text-white">
            {resolved.data.restaurant.name}
          </h1>
          <p className="mt-0.5 text-sm text-white/70">
            Table {order.table.label ?? order.table.number}
          </p>
        </div>
      </header>

      <main className="space-y-4 p-4">
        <OrderStatus
          status={order.status}
          paymentMethod={order.paymentMethod}
          paymentStatus={order.paymentStatus}
        />

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Items</h2>
          <ul className="space-y-2.5">
            {order.items.map((it) => (
              <li key={it.id} className="flex justify-between text-sm">
                <span className="text-slate-700">
                  <span className="font-medium">{it.qty}×</span>{" "}
                  {it.nameSnapshot}
                  {it.note && (
                    <span className="ml-1 text-xs text-slate-400">— {it.note}</span>
                  )}
                </span>
                <span className="font-semibold text-slate-900">
                  €{(it.lineTotalCents / 100).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          <hr className="my-3 border-slate-100" />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>€{(order.subtotalCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Tax</span>
              <span>€{(order.taxCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Service</span>
              <span>€{(order.serviceCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 text-base font-bold text-slate-900">
              <span>Total</span>
              <span>€{(order.totalCents / 100).toFixed(2)}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
