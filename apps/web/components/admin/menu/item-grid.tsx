"use client";

import { useState } from "react";
import { ItemCard } from "./item-card";
import { ItemDialog } from "./item-dialog";

type Cat = { id: string; name: string };
type Item = {
  id: string; name: string; description: string | null; priceCents: number;
  station: "kitchen" | "bar" | "both"; isAvailable: boolean; categoryId: string;
  images: { id: string; path: string; sortOrder: number }[];
};

export function ItemGrid({
  categories, activeCategoryId, items,
}: { categories: Cat[]; activeCategoryId: string | null; items: Item[] }) {
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);

  if (!activeCategoryId) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-slate-500">
        Create a category on the left to start adding items.
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{items.length} item{items.length === 1 ? "" : "s"}</h2>
        <button
          onClick={() => setCreating(true)}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600"
        >
          Add item
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} onEdit={() => setEditing(item)} />
        ))}
      </div>
      {creating && (
        <ItemDialog
          open
          onClose={() => setCreating(false)}
          categories={categories}
          defaultCategoryId={activeCategoryId}
        />
      )}
      {editing && (
        <ItemDialog
          open
          onClose={() => setEditing(null)}
          categories={categories}
          item={editing}
        />
      )}
    </>
  );
}
