"use server";

import { requireMembership } from "@/lib/membership";
import {
  bulkCreateTables, renameTable, archiveTable,
} from "@/server/services/table";

export async function bulkCreateTablesAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return bulkCreateTables(restaurantId, raw);
}

export async function renameTableAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return renameTable(restaurantId, raw);
}

export async function archiveTableAction(id: string) {
  const { restaurantId } = await requireMembership();
  return archiveTable(restaurantId, id);
}
