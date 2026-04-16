import { requireMembership } from "@/lib/membership";
import { listCategories } from "@/server/services/category";
import { listItems } from "@/server/services/menu-item";
import { CategoryList } from "@/components/admin/menu/category-list";
import { ItemGrid } from "@/components/admin/menu/item-grid";

export const metadata = { title: "Menu" };
export const dynamic = "force-dynamic";

export default async function MenuPage({
  searchParams,
}: { searchParams: { category?: string } }) {
  const { restaurantId } = await requireMembership();
  const categories = await listCategories(restaurantId);
  const activeId = searchParams.category ?? categories[0]?.id ?? null;
  const items = activeId ? await listItems(restaurantId, { categoryId: activeId }) : [];

  return (
    <div className="flex h-full gap-6">
      <CategoryList categories={categories} activeId={activeId} />
      <div className="flex-1">
        <ItemGrid
          categories={categories}
          activeCategoryId={activeId}
          items={items}
        />
      </div>
    </div>
  );
}
