import Link from "next/link";
import { requireRestaurant } from "@/lib/auth-helpers";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { restaurant, restaurantId } = await requireRestaurant();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-slate-600">
        Slug: <code className="rounded bg-slate-100 px-1.5 py-0.5">{restaurant.slug}</code> · ID:{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5">{restaurantId}</code>
      </p>
      <div className="rounded-lg border border-dashed p-8 text-center text-slate-500">
        Live order widgets land here in a later phase. For now, manage your{" "}
        <Link href="/menu" className="text-brand-600 underline">Menu</Link> or{" "}
        <Link href="/tables" className="text-brand-600 underline">Tables</Link>.
      </div>
    </div>
  );
}
