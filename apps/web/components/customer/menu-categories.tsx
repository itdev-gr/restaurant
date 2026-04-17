import Link from "next/link";

type Cat = { id: string; name: string };

export function MenuCategories({
  slug, token, categories, activeId,
}: { slug: string; token: string; categories: Cat[]; activeId: string | null }) {
  if (categories.length === 0) return null;
  return (
    <div className="sticky top-0 z-10 bg-white shadow-sm">
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/r/${slug}/t/${token}?category=${c.id}`}
            scroll={false}
            className={`inline-flex shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeId === c.id
                ? "bg-brand-500 text-white shadow-md shadow-brand-500/25"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
