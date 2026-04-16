"use server";

import { resolveTableFromToken } from "@/server/services/table-session";
import { createOrder } from "@/server/services/order";
import type { ActionResult } from "@/server/actions/auth";

export async function submitOrderAction(
  slug: string,
  token: string,
  raw: unknown,
): Promise<ActionResult<{ code: string }>> {
  const resolved = await resolveTableFromToken(slug, token);
  if (!resolved.ok) {
    return {
      ok: false,
      error: { code: "NO_SESSION", message: "Table not available. Rescan the QR code." },
    };
  }
  const result = await createOrder(resolved.data.restaurantId, resolved.data.tableId, raw);
  if (!result.ok) return result;
  return { ok: true, data: { code: result.data.code } };
}
