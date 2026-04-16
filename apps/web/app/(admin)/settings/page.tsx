import { requireAdminRole } from "@/lib/require-role";
import { getRestaurantSettings } from "@/server/services/restaurant-settings";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { restaurantId } = await requireAdminRole();
  const settings = await getRestaurantSettings(restaurantId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-sm text-slate-600">
        Slug:{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5">
          {settings.slug}
        </code>
      </p>
      <SettingsForm
        current={{
          name: settings.name,
          address: settings.address,
          currency: settings.currency,
          taxRate: settings.taxRate.toString(),
          serviceChargePct: settings.serviceChargePct.toString(),
        }}
      />
    </div>
  );
}
