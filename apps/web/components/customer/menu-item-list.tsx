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

const GRADIENTS = [
  "from-orange-200 to-amber-100",
  "from-sky-200 to-cyan-100",
  "from-violet-200 to-purple-100",
  "from-rose-200 to-pink-100",
  "from-emerald-200 to-teal-100",
  "from-indigo-200 to-blue-100",
];

function hashIndex(str: string, max: number) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h) % max;
}

export function MenuItemList({
  items,
  currency,
  tableId,
}: {
  items: Item[];
  currency: string;
  tableId: string;
}) {
  const [open, setOpen] = useState<Item | null>(null);
  return (
    <>
      <div className="space-y-3">
        {items.map((item) => {
          const grad = GRADIENTS[hashIndex(item.id, GRADIENTS.length)]!;
          return (
            <button
              key={item.id}
              onClick={() => setOpen(item)}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm transition-all active:scale-[0.98] active:shadow-md"
            >
              <div
                className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${grad}`}
              >
                <span className="text-2xl font-bold text-white/80">
                  {item.name.slice(0, 1).toUpperCase()}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h3 className="truncate font-semibold text-slate-900">{item.name}</h3>
                {item.description && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
                    {item.description}
                  </p>
                )}
                <div className="mt-auto pt-1 text-sm font-bold text-brand-600">
                  {currency} {(item.priceCents / 100).toFixed(2)}
                </div>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>
      {open && (
        <ItemSheet
          item={open}
          currency={currency}
          onClose={() => setOpen(null)}
          onAdd={(qty, note) => {
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
