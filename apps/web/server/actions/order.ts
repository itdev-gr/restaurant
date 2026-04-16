"use server";

import { cookies } from "next/headers";
import { TABLE_COOKIE, verifyTableCookie } from "@/lib/table-session";
import { createOrder } from "@/server/services/order";
import type { ActionResult } from "@/server/actions/auth";

export async function submitOrderAction(
  raw: unknown,
): Promise<ActionResult<{ code: string }>> {
  const cookieValue = cookies().get(TABLE_COOKIE)?.value;
  const session = verifyTableCookie(cookieValue);
  if (!session) {
    return {
      ok: false,
      error: { code: "NO_SESSION", message: "Table session expired. Rescan the QR code." },
    };
  }
  const result = await createOrder(session.rid, session.tid, raw);
  if (!result.ok) return result;
  return { ok: true, data: { code: result.data.code } };
}
