"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCategoryAction } from "@/server/actions/category";

type Cat = { id: string; name: string };

export function CategoryList({
  categories, activeId,
}: { categories: Cat[]; activeId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const r = await createCategoryAction({ name });
      if (!r.ok) { setError(r.error.message); return; }
      setName("");
      router.refresh();
    });
  };

  return (
    <aside className="w-56 shrink-0 border-r pr-4">
      <h1 className="mb-4 text-lg font-semibold">Menu</h1>
      <nav className="flex flex-col gap-1">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/menu?category=${c.id}`}
            className={`rounded-md px-3 py-2 text-sm ${activeId === c.id ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"}`}
          >
            {c.name}
          </Link>
        ))}
      </nav>
      <div className="mt-6 space-y-2 border-t pt-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category"
          className="input"
        />
        <button
          onClick={add}
          disabled={pending || !name.trim()}
          className="w-full rounded-md bg-brand-500 px-3 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add category"}
        </button>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </div>
    </aside>
  );
}
