import { requireMembership } from "@/lib/membership";
import { listTables } from "@/server/services/table";
import { TableGrid } from "@/components/admin/tables/table-grid";

export const metadata = { title: "Tables" };
export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const { restaurantId } = await requireMembership();
  const tables = await listTables(restaurantId);
  return <TableGrid tables={tables} />;
}
