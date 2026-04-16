import { requireRestaurant } from "@/lib/auth-helpers";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { restaurant, restaurantId } = await requireRestaurant();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-slate-600">
        Slug: <code className="rounded bg-slate-100 px-1.5 py-0.5">{restaurant.slug}</code> · ID: <code className="rounded bg-slate-100 px-1.5 py-0.5">{restaurantId}</code>
      </p>
      <div className="rounded-lg border border-dashed p-8 text-center text-slate-500">
        Dashboard widgets land here in Phase 5. For now, head to <a href="/menu" className="text-brand-600 underline">Menu</a> or <a href="/tables" className="text-brand-600 underline">Tables</a> (coming in Phase 1B).
      </div>
    </div>
  );
}
