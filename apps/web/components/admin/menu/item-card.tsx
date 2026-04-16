"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { setAvailabilityAction } from "@/server/actions/menu-item";

type Item = {
  id: string; name: string; description: string | null; priceCents: number;
  station: "kitchen" | "bar" | "both"; isAvailable: boolean;
  images: { id: string; path: string; sortOrder: number }[];
};

export function ItemCard({ item, onEdit }: { item: Item; onEdit: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = (next: boolean) => {
    startTransition(async () => {
      await setAvailabilityAction({ id: item.id, isAvailable: next });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="aspect-video bg-slate-100 text-center text-xs text-slate-400">
        {item.images.length > 0 ? "[image]" : "no image"}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <button onClick={onEdit} className="text-left">
            <h3 className="font-medium hover:text-brand-700">{item.name}</h3>
            {item.description && (
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description}</p>
            )}
          </button>
          <span className="shrink-0 text-sm font-semibold">
            €{(item.priceCents / 100).toFixed(2)}
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
            {item.station}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">
              {item.isAvailable ? "available" : "86'd"}
            </span>
            <Switch
              checked={item.isAvailable}
              onChange={toggle}
              label="Availability"
              disabled={pending}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
