import Link from "next/link";
import { requireRestaurant } from "@/lib/auth-helpers";
import { getDashboardStats } from "@/server/services/dashboard-stats";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { restaurant, restaurantId } = await requireRestaurant();
  const stats = await getDashboardStats(restaurantId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-600">
          Slug: <code className="rounded bg-slate-100 px-1.5 py-0.5">{restaurant.slug}</code>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today's Orders" value={String(stats.todayOrderCount)} />
        <StatCard label="Today's Revenue" value={`€${(stats.todayRevenueCents / 100).toFixed(2)}`} />
        <StatCard label="Pending Orders" value={String(stats.pendingOrders)} highlight={stats.pendingOrders > 0} />
        <StatCard label="Active Tables" value={String(stats.totalTables)} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <QuickLink href="/orders" label="Orders" desc="View and manage incoming orders" />
        <QuickLink href="/menu" label="Menu" desc="Edit categories and items" />
        <QuickLink href="/tables" label="Tables" desc="Manage tables and QR codes" />
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-brand-500 bg-brand-50" : "bg-white"}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function QuickLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <Link href={href} className="rounded-lg border bg-white p-4 hover:bg-slate-50">
      <div className="font-semibold">{label}</div>
      <div className="mt-1 text-xs text-slate-500">{desc}</div>
    </Link>
  );
}
