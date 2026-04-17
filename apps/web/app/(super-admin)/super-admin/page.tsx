import Link from "next/link";
import { listAllRestaurants, getSystemStats } from "@/server/services/super-admin";

export const metadata = { title: "Super Admin" };
export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const [restaurants, stats] = await Promise.all([
    listAllRestaurants(),
    getSystemStats(),
  ]);

  const fulfilled = stats.ordersByStatus.find((s) => s.status === "served")?.count ?? 0;
  const cancelled = stats.ordersByStatus.find((s) => s.status === "cancelled")?.count ?? 0;
  const cashOrders = stats.ordersByPayment.filter((p) => p.method === "cash");
  const cardOrders = stats.ordersByPayment.filter((p) => p.method === "card");
  const cashCount = cashOrders.reduce((s, p) => s + p.count, 0);
  const cardCount = cardOrders.reduce((s, p) => s + p.count, 0);
  const cashRevenue = cashOrders.reduce((s, p) => s + p.totalCents, 0);
  const cardRevenue = cardOrders.reduce((s, p) => s + p.totalCents, 0);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">System Overview</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Restaurants" value={String(stats.totalRestaurants)} />
        <StatCard label="Users" value={String(stats.totalUsers)} />
        <StatCard label="Total Orders" value={String(stats.totalOrders)} />
        <StatCard label="Total Revenue" value={`€${(stats.totalRevenueCents / 100).toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Fulfilled" value={String(fulfilled)} color="green" />
        <StatCard label="Cancelled" value={String(cancelled)} color="red" />
        <StatCard label="Cash Orders" value={`${cashCount} (€${(cashRevenue / 100).toFixed(2)})`} />
        <StatCard label="Card Orders" value={`${cardCount} (€${(cardRevenue / 100).toFixed(2)})`} />
      </div>

      <section>
        <h2 className="mb-4 text-xl font-semibold">All Restaurants</h2>
        <div className="space-y-3">
          {restaurants.map((r) => (
            <Link
              key={r.id}
              href={`/super-admin/restaurant/${r.id}`}
              className="flex items-center justify-between rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div>
                <div className="font-semibold text-slate-900">{r.name}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {r.slug} · {r.address ?? "No address"} · {r.currency}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Created {new Date(r.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-4 text-center text-xs">
                <div>
                  <div className="text-lg font-bold text-slate-900">{r._count.orders}</div>
                  <div className="text-slate-500">orders</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{r._count.menuItems}</div>
                  <div className="text-slate-500">items</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{r._count.tables}</div>
                  <div className="text-slate-500">tables</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{r._count.memberships}</div>
                  <div className="text-slate-500">staff</div>
                </div>
              </div>
            </Link>
          ))}
          {restaurants.length === 0 && (
            <div className="rounded-xl border border-dashed p-8 text-center text-slate-500">
              No restaurants registered yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: "green" | "red" }) {
  const c = color === "green" ? "text-green-600" : color === "red" ? "text-red-600" : "text-slate-900";
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${c}`}>{value}</div>
    </div>
  );
}
