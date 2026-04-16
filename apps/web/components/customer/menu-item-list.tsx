"use client";

import { useState } from "react";
import { ItemSheet } from "./item-sheet";
import { addLine } from "@/lib/cart";

type Item = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  images: { id: string; path: string; sortOrder: number }[];
};

export function MenuItemList({
  items, currency,
}: {
  items: Item[];
  currency: string;
}) {
  const [open, setOpen] = useState<Item | null>(null);
  return (
    <>
      <div className="grid grid-cols-1 gap-3">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setOpen(item)}
            className="flex items-start gap-3 rounded-lg border bg-white p-3 text-left shadow-sm"
          >
            <div className="flex-1">
              <div className="font-medium">{item.name}</div>
              {item.description && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description}</p>
              )}
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {currency} {(item.priceCents / 100).toFixed(2)}
              </div>
            </div>
          </button>
        ))}
      </div>
      {open && (
        <ItemSheet
          item={open}
          currency={currency}
          onClose={() => setOpen(null)}
          onAdd={(qty, note) => {
            const tableId =
              (document.querySelector("[data-table-id]") as HTMLElement | null)?.dataset["tableId"];
            if (!tableId) return;
            addLine(tableId, {
              menuItemId: open.id,
              name: open.name,
              priceCents: open.priceCents,
              qty,
              ...(note ? { note } : {}),
            });
            setOpen(null);
          }}
        />
      )}
    </>
  );
}
