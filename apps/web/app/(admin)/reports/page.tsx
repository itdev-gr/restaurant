import { requireAdminRole } from "@/lib/require-role";
import { getRevenueByDay, getTopItems, getPaymentSplit } from "@/server/services/reports";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const { restaurantId } = await requireAdminRole();
  const [revenue, topItems, paymentSplit] = await Promise.all([
    getRevenueByDay(restaurantId),
    getTopItems(restaurantId),
    getPaymentSplit(restaurantId),
  ]);

  const maxRevenue = Math.max(...revenue.map((r) => r.cents), 1);
  const maxQty = Math.max(...topItems.map((i) => i.qty), 1);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Reports</h1>

      {/* Revenue by day */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Revenue — Last 7 days</h2>
        <div className="space-y-2">
          {revenue.map((r) => (
            <div key={r.date} className="flex items-center gap-3">
              <span className="w-24 text-xs text-slate-600">{r.date}</span>
              <div className="flex-1">
                <div
                  className="h-6 rounded bg-brand-500"
                  style={{ width: `${(r.cents / maxRevenue) * 100}%`, minWidth: r.cents > 0 ? "4px" : "0" }}
                />
              </div>
              <span className="w-20 text-right text-sm font-medium">
                €{(r.cents / 100).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Top items */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Top Items</h2>
        {topItems.length === 0 ? (
          <p className="text-sm text-slate-500">No orders yet.</p>
        ) : (
          <div className="space-y-2">
            {topItems.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="w-6 text-center text-sm font-medium text-slate-500">{i + 1}</span>
                <span className="w-40 truncate text-sm">{item.name}</span>
                <div className="flex-1">
                  <div
                    className="h-5 rounded bg-slate-300"
                    style={{ width: `${(item.qty / maxQty) * 100}%`, minWidth: "4px" }}
                  />
                </div>
                <span className="w-12 text-right text-sm font-medium">{item.qty}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payment split */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Payment Methods</h2>
        {paymentSplit.length === 0 ? (
          <p className="text-sm text-slate-500">No orders yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {paymentSplit.map((s) => (
              <div key={s.method} className="rounded-lg border bg-white p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {s.method}
                </div>
                <div className="mt-1 text-xl font-semibold">
                  {s.count} order{s.count === 1 ? "" : "s"}
                </div>
                <div className="text-sm text-slate-600">
                  €{(s.totalCents / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
