import { notFound } from "next/navigation";
import { resolveTableFromToken } from "@/server/services/table-session";
import { listCategories } from "@/server/services/category";
import { listItems } from "@/server/services/menu-item";
import { MenuCategories } from "@/components/customer/menu-categories";
import { MenuItemList } from "@/components/customer/menu-item-list";
import { CartBar } from "@/components/customer/cart-bar";

export const dynamic = "force-dynamic";

export default async function CustomerMenuPage({
  params, searchParams,
}: {
  params: { slug: string; token: string };
  searchParams: { category?: string };
}) {
  const resolved = await resolveTableFromToken(params.slug, params.token);
  if (!resolved.ok) notFound();

  const categories = await listCategories(resolved.data.restaurantId);
  const activeId = searchParams.category ?? categories[0]?.id ?? null;
  const items = activeId
    ? await listItems(resolved.data.restaurantId, { categoryId: activeId })
    : [];

  return (
    <>
      <header className="customer-header-gradient px-5 pb-5 pt-safe-top">
        <div className="flex items-center justify-between pt-4">
          <div>
            <h1 className="text-xl font-bold text-white">{resolved.data.restaurant.name}</h1>
            <p className="mt-0.5 text-sm text-white/70">Browse our menu</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 backdrop-blur-sm">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
            </svg>
            <span className="text-sm font-semibold text-white">
              {resolved.data.table.label ?? `Table ${resolved.data.table.number}`}
            </span>
          </div>
        </div>
      </header>

      <MenuCategories
        slug={params.slug}
        token={params.token}
        categories={categories}
        activeId={activeId}
      />

      <main className="px-4 pb-28 pt-4">
        {items.filter((i) => i.isAvailable).length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="text-4xl">🍽️</div>
            <p className="text-sm text-slate-500">No items in this category yet.</p>
          </div>
        ) : (
          <MenuItemList
            items={items.filter((i) => i.isAvailable)}
            currency={resolved.data.restaurant.currency}
            tableId={resolved.data.tableId}
          />
        )}
      </main>

      <CartBar
        slug={params.slug}
        token={params.token}
        tableId={resolved.data.tableId}
        currency={resolved.data.restaurant.currency}
      />
    </>
  );
}
