import Link from "next/link";

type Cat = { id: string; name: string };

export function MenuCategories({
  slug, token, categories, activeId,
}: { slug: string; token: string; categories: Cat[]; activeId: string | null }) {
  if (categories.length === 0) {
    return <div className="border-b bg-slate-50 px-4 py-2 text-sm text-slate-500">No menu yet.</div>;
  }
  return (
    <div className="sticky top-[64px] z-10 overflow-x-auto border-b bg-white">
      <div className="flex gap-1 px-4 py-2">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/r/${slug}/t/${token}?category=${c.id}`}
            scroll={false}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${activeId === c.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
