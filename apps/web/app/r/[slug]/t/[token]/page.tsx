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
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Table {resolved.data.table.label ?? resolved.data.table.number}
        </div>
        <h1 className="text-lg font-semibold">{resolved.data.restaurant.name}</h1>
      </header>
      <MenuCategories
        slug={params.slug}
        token={params.token}
        categories={categories}
        activeId={activeId}
      />
      <main className="px-4 pb-24 pt-4">
        <MenuItemList items={items.filter((i) => i.isAvailable)} currency={resolved.data.restaurant.currency} />
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
