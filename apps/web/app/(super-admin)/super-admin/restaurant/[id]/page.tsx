import Link from "next/link";
import { notFound } from "next/navigation";
import { getRestaurantDetail } from "@/server/services/super-admin";

export const dynamic = "force-dynamic";

export default async function RestaurantDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let data;
  try {
    data = await getRestaurantDetail(params.id);
  } catch {
    notFound();
  }

  const { restaurant, categories, menuItems, tables, orders, staff, stats } = data;
  const fulfilled = stats.byStatus.find((s) => s.status === "served")?.count ?? 0;
  const cancelled = stats.byStatus.find((s) => s.status === "cancelled")?.count ?? 0;
  const pending = stats.byStatus
    .filter((s) => ["received", "preparing", "ready"].includes(s.status))
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-8">
      <Link href="/super-admin" className="text-sm text-slate-500 hover:text-slate-700">
        ← All restaurants
      </Link>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">{restaurant.name}</h1>
        <div className="mt-2 space-y-1 text-sm text-slate-500">
          <div>Slug: <code className="rounded bg-slate-100 px-1.5 py-0.5">{restaurant.slug}</code></div>
          <div>Address: {restaurant.address ?? "—"}</div>
          <div>Currency: {restaurant.currency} · Tax: {restaurant.taxRate.toString()}% · Service: {restaurant.serviceChargePct.toString()}%</div>
          <div>Created: {new Date(restaurant.createdAt).toLocaleString()}</div>
          <div>ID: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{restaurant.id}</code></div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SC label="Total Orders" value={String(stats.totalOrders)} />
        <SC label="Revenue" value={`€${(stats.totalRevenueCents / 100).toFixed(2)}`} />
        <SC label="Fulfilled" value={String(fulfilled)} color="green" />
        <SC label="Pending" value={String(pending)} color="amber" />
        <SC label="Cancelled" value={String(cancelled)} color="red" />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Payment Breakdown</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {stats.byPayment.map((p) => (
            <div key={p.method} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{p.method}</div>
              <div className="mt-1 text-lg font-bold">{p.count} orders</div>
              <div className="text-sm text-slate-600">€{(p.totalCents / 100).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Staff ({staff.length})</h2>
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {staff.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 font-medium">{m.user.name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{m.user.email}</td>
                  <td className="px-4 py-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{m.role}</span></td>
                  <td className="px-4 py-2 text-slate-500">{new Date(m.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Menu ({menuItems.length} items in {categories.length} categories)</h2>
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Station</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {menuItems.map((item) => (
                <tr key={item.id} className={item.isArchived ? "opacity-50" : ""}>
                  <td className="px-4 py-2 font-medium">{item.name}</td>
                  <td className="px-4 py-2 text-slate-600">{item.category.name}</td>
                  <td className="px-4 py-2">€{(item.priceCents / 100).toFixed(2)}</td>
                  <td className="px-4 py-2"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{item.station}</span></td>
                  <td className="px-4 py-2">
                    {item.isArchived
                      ? <span className="text-xs text-red-500">archived</span>
                      : item.isAvailable
                        ? <span className="text-xs text-green-600">available</span>
                        : <span className="text-xs text-orange-500">86&#39;d</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Tables ({tables.length})</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {tables.map((t) => (
            <div key={t.id} className={`rounded-lg border p-2 text-center text-xs ${t.isArchived ? "bg-slate-100 opacity-50" : "bg-white"}`}>
              <div className="font-bold">{t.number}</div>
              <div className="truncate text-slate-400">{t.label ?? ""}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent Orders (last 50)</h2>
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Table</th>
                <th className="px-4 py-2">Items</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Payment</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2 font-mono font-medium">{o.code}</td>
                  <td className="px-4 py-2">{o.table.label ?? `Table ${o.table.number}`}</td>
                  <td className="px-4 py-2 text-slate-600">{o.items.map((it) => `${it.qty}× ${it.nameSnapshot}`).join(", ")}</td>
                  <td className="px-4 py-2 font-medium">€{(o.totalCents / 100).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{o.paymentMethod}</span>{" "}
                    <span className={`text-xs ${o.paymentStatus === "paid" ? "text-green-600" : o.paymentStatus === "refunded" ? "text-red-500" : "text-orange-500"}`}>{o.paymentStatus}</span>
                  </td>
                  <td className="px-4 py-2"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{o.status}</span></td>
                  <td className="px-4 py-2 text-slate-500">{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SC({ label, value, color }: { label: string; value: string; color?: "green" | "red" | "amber" }) {
  const c = color === "green" ? "text-green-600" : color === "red" ? "text-red-600" : color === "amber" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${c}`}>{value}</div>
    </div>
  );
}
